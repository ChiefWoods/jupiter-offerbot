import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import type { Client } from "discord.js";
import { createSubscriptionApi } from "./api";
import { createBot } from "./bot";
import { env } from "./env";
import { createWebhookHandler } from "./webhook";

export function createApp(messenger: Client, webhookSecret: string, corsAllowedOrigin: string[]) {
  const notificationHandler = createWebhookHandler(messenger, webhookSecret);
  return new Hono()
    .use("*", cors({ origin: corsAllowedOrigin }))
    .use(logger())
    .use("*", requestId())
    .get("/health", (c) => c.json({ ok: true }))
    .post("/internal/notifications", (c) => notificationHandler(c.req.raw))
    .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404))
    .onError((_error, c) =>
      c.json(
        {
          error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
          meta: { requestId: c.get("requestId") },
        },
        500,
      ),
    );
}

if (import.meta.main) {
  const subscriptions = createSubscriptionApi(env.API_BASE_URL, env.DISCORD_BRIDGE_TOKEN);
  const bot = createBot(subscriptions);
  const app = createApp(bot, env.DISCORD_WEBHOOK_SECRET, env.CORS_ALLOWED_ORIGIN);

  void bot
    .login(env.DISCORD_BOT_TOKEN)
    .catch((error) => console.error("Discord login failed", error));
  const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
  console.log(`Offerbot Discord bridge listening on http://localhost:${server.port}`);

  const shutdown = () => {
    bot.destroy();
    server.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
