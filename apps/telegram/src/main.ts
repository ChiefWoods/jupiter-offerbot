import { createChannelApp } from "@jupiter-offerbot/channel";
import { createSubscriptionApi } from "@jupiter-offerbot/channel";
import type { Api } from "grammy";
import { createBot } from "./bot";
import { createWebhookHandler } from "./webhook";
import { env } from "./env";

export function createApp(messenger: Api, webhookSecret: string, corsAllowedOrigin: string[]) {
  const notificationHandler = createWebhookHandler(messenger, webhookSecret);
  return createChannelApp(notificationHandler, corsAllowedOrigin);
}

if (import.meta.main) {
  const subscriptions = createSubscriptionApi(
    env.API_BASE_URL,
    env.TELEGRAM_BRIDGE_TOKEN,
    "telegram",
  );
  const bot = createBot(env.TELEGRAM_BOT_TOKEN, subscriptions);
  const app = createApp(bot.api, env.TELEGRAM_WEBHOOK_SECRET, env.CORS_ALLOWED_ORIGIN);

  await bot.api.setMyCommands([
    { command: "start", description: "Show Offerbot help" },
    { command: "list", description: "List your watched mints" },
    { command: "watch", description: "Watch a mint at an optional APY ceiling" },
    { command: "update", description: "Update a watched mint's APY ceiling" },
    { command: "unwatch", description: "Stop watching a mint" },
  ]);
  void bot.start({ drop_pending_updates: true });

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(`Offerbot Telegram bridge listening on port ${server.port}`);

  const shutdown = () => {
    bot.stop();
    server.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
