import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import type { Api } from "grammy";
import { createSubscriptionApi } from "./api";
import { createBot } from "./bot";
import { createWebhookHandler } from "./webhook";
import { env } from "./env";

export function createApp(messenger: Api, webhookSecret: string, corsAllowedOrigin: string[]) {
  const notificationHandler = createWebhookHandler(messenger, webhookSecret);
  return new Hono()
    .use("*", cors({ origin: corsAllowedOrigin }))
    .use(logger())
    .use("*", requestId())
    .get("/health", (c) => c.json({ ok: true }))
    .post("/internal/notifications", (c) => notificationHandler(c.req.raw))
    .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404))
    .onError((_error, c) => {
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
  const subscriptions = createSubscriptionApi(env.API_BASE_URL, env.TELEGRAM_BRIDGE_TOKEN);
  const bot = createBot(env.TELEGRAM_BOT_TOKEN, subscriptions);
  const app = createApp(bot.api, env.TELEGRAM_WEBHOOK_SECRET, env.CORS_ALLOWED_ORIGIN);

  await bot.api.setMyCommands([
    { command: "start", description: "Show Offerbot help" },
    { command: "watches", description: "List your watched mints" },
    { command: "watch", description: "Watch a mint at an optional APY ceiling" },
    { command: "unwatch", description: "Stop watching a mint" },
  ]);
  void bot.start({ drop_pending_updates: true });

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(`Offerbot Telegram bridge listening on http://localhost:${server.port}`);

  const shutdown = () => {
    bot.stop();
    server.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
