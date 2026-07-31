import { Bot } from "grammy";
import type { SubscriptionApi } from "./api";
import { createCommandHandlers } from "./commands";

export function createBot(token: string, subscriptions: SubscriptionApi) {
  const bot = new Bot(token);
  const commands = createCommandHandlers(subscriptions);
  bot.command("start", (context) => commands.start(context));
  bot.command("list", (context) => commands.list(context));
  bot.command("watch", (context) => commands.watch(context));
  bot.command("update", (context) => commands.update(context));
  bot.command("unwatch", (context) => commands.unwatch(context));
  bot.catch((error) => console.error("Telegram update failed", error));
  return bot;
}
