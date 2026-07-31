import { createChannelApp } from "@jupiter-offerbot/channel";
import { createSubscriptionApi } from "@jupiter-offerbot/channel";
import type { Client } from "discord.js";
import { createBot } from "./bot";
import { env } from "./env";
import { createWebhookHandler } from "./webhook";

export function createApp(messenger: Client, webhookSecret: string, corsAllowedOrigin: string[]) {
  const notificationHandler = createWebhookHandler(messenger, webhookSecret);
  return createChannelApp(notificationHandler, corsAllowedOrigin);
}

if (import.meta.main) {
  const subscriptions = createSubscriptionApi(
    env.API_BASE_URL,
    env.DISCORD_BRIDGE_TOKEN,
    "discord",
  );
  const bot = createBot(subscriptions);
  const app = createApp(bot, env.DISCORD_WEBHOOK_SECRET, env.CORS_ALLOWED_ORIGIN);

  void bot
    .login(env.DISCORD_BOT_TOKEN)
    .catch((error) => console.error("Discord login failed", error));
  const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
  console.log(`Offerbot Discord bridge listening on port ${server.port}`);

  const shutdown = () => {
    bot.destroy();
    server.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
