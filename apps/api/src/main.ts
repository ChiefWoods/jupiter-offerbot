import {
  createOfferRepository,
  createPrismaClient,
  createSubscriptionRepository,
  type OfferRepository,
  type SubscriptionRepository,
} from "@jupiter-offerbot/prisma";
import { Hono, type MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { env } from "./env";
import { createJupiterClient } from "./jupiter";
import { ApiError } from "./error";
import { createRateLimitMiddleware, createRedisRateLimitStore } from "./rate-limit";
import { createOffersRouter } from "./routes/offers";
import { createSubscriptionsRouter } from "./routes/subscriptions";

export type ApiDependencies = {
  bridgeTokens: Record<"discord" | "telegram", string>;
  listenerToken: string;
  subscriptions: SubscriptionRepository;
  offers: OfferRepository;
  ready?: () => Promise<unknown>;
  allowedOrigins: string[];
  rateLimit: MiddlewareHandler;
};

export function createApp(dependencies: ApiDependencies) {
  return new Hono()
    .use("*", cors({ origin: dependencies.allowedOrigins }))
    .use(logger())
    .use("*", requestId())
    .use("/v1/*", dependencies.rateLimit)
    .get("/health", (c) => c.json({ ok: true }))
    .get("/ready", async (c) => {
      try {
        await (dependencies.ready?.() ?? Promise.resolve());
        return c.json({ ok: true });
      } catch {
        return c.json({ ok: false }, 503);
      }
    })
    .route(
      "/v1/subscriptions",
      createSubscriptionsRouter(dependencies.subscriptions, dependencies.bridgeTokens),
    )
    .route("/v1/offers", createOffersRouter(dependencies.offers, dependencies.listenerToken))
    .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404))
    .onError((error, c) => {
      if (error instanceof ApiError)
        return c.json({ error: { code: error.code, message: error.message } }, error.status);
      return c.json(
        {
          error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
          meta: { requestId: c.get("requestId") },
        },
        500,
      );
    });
}

if (import.meta.main) {
  const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });
  const jupiter = createJupiterClient(env.JUPITER_API_KEY, env.JUPITER_API_URL);
  const app = createApp({
    bridgeTokens: { discord: env.DISCORD_BRIDGE_TOKEN, telegram: env.TELEGRAM_BRIDGE_TOKEN },
    listenerToken: env.LISTENER_API_TOKEN,
    subscriptions: createSubscriptionRepository(prisma, env.MAX_SUBSCRIPTIONS_PER_USER, jupiter),
    offers: createOfferRepository(prisma),
    ready: () => prisma.$queryRaw`SELECT 1`,
    allowedOrigins: env.CORS_ALLOWED_ORIGINS,
    rateLimit: createRateLimitMiddleware(createRedisRateLimitStore(env.REDIS_URL), {
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      trustedHeaderName: env.RATE_LIMIT_TRUSTED_IP_HEADER,
    }),
  });
  const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
  console.log(`Offerbot API listening on port ${server.port}`);

  const shutdown = async () => {
    server.stop();
    await prisma.$disconnect();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
