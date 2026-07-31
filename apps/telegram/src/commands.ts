import { isAddress } from "@solana/kit";
import type { CommandContext, Context } from "grammy";
import { formatApy, parseDisplayApy } from "./apy";
import { ApiClientError, type SubscriptionApi } from "./api";

function userId(context: CommandContext<Context>): string | null {
  if (context.chat?.type !== "private" || !context.from) return null;
  return context.from.id.toString();
}

function apiMessage(error: unknown): string {
  if (!(error instanceof ApiClientError))
    return "Offerbot could not reach the subscription service. Please try again.";
  switch (error.code) {
    case "SUBSCRIPTION_ALREADY_EXISTS":
      return "You already watch that mint.";
    case "SUBSCRIPTION_LIMIT_REACHED":
      return "You have reached your subscription limit.";
    case "SUBSCRIPTION_NOT_FOUND":
      return "There is no subscription for that mint to cancel.";
    default:
      return "Offerbot could not complete that request. Please try again.";
  }
}

export function createCommandHandlers(api: SubscriptionApi) {
  const requireDirectMessage = async (context: CommandContext<Context>) => {
    const id = userId(context);
    if (!id)
      await context.reply(
        "Subscription commands are available only in a private chat with Offerbot.",
      );
    return id;
  };
  return {
    async start(context: CommandContext<Context>) {
      await context.reply(
        `Welcome to Offerbot!
        
Commands:
  \`/watch <mint> [max_apy]\` - Watch a mint at an optional APY ceiling
  \`/list\` - List your watched mints
  \`/unwatch <mint>\` - Stop watching a mint`,
      );
    },
    async list(context: CommandContext<Context>) {
      const id = await requireDirectMessage(context);
      if (!id) return;

      try {
        const subscriptions = await api.list(id);
        if (!subscriptions.length) {
          await context.reply(
            "You are not watching any mints yet. Use /watch <mint> [max_apy] to begin.",
          );
          return;
        }
        await context.reply(
          subscriptions
            .map(
              (subscription) =>
                `${subscription.mint} — ${subscription.maxApy === null ? "any APY" : formatApy(subscription.maxApy)}\n/unwatch ${subscription.mint}`,
            )
            .join("\n\n"),
        );
      } catch (error) {
        await context.reply(apiMessage(error));
      }
    },
    async watch(context: CommandContext<Context>) {
      const id = await requireDirectMessage(context);
      if (!id) return;

      const [mint, maxApyText, ...extra] = context.match.trim().split(/\s+/);

      if (!mint || extra.length || !isAddress(mint)) {
        await context.reply("Provide a valid Solana mint: /watch <mint> [max_apy].");
        return;
      }

      const maxApy = maxApyText === undefined ? null : parseDisplayApy(maxApyText);

      if (maxApy === null && maxApyText !== undefined) {
        await context.reply(
          "APY must be a non-negative number with at most two decimal places, for example 7.25.",
        );
        return;
      }

      try {
        await api.create({ platform: "telegram", userId: id, mint, maxApy });
        await context.reply(
          `Watching ${mint} at ${maxApy === null ? "any APY" : `up to ${formatApy(maxApy)}`} APY.`,
        );
      } catch (error) {
        await context.reply(apiMessage(error));
      }
    },
    async unwatch(context: CommandContext<Context>) {
      const id = await requireDirectMessage(context);
      if (!id) return;

      const mint = context.match.trim();

      if (mint === "") {
        await context.reply("Provide the mint to cancel: /unwatch <mint>.");
        return;
      }

      if (!isAddress(mint)) {
        await context.reply("Provide a valid Solana mint: /unwatch <mint>.");
        return;
      }

      try {
        const subscription = (await api.list(id)).find((item) => item.mint === mint);
        if (!subscription || !(await api.remove(subscription.id))) {
          await context.reply("There is no subscription for that mint to cancel.");
          return;
        }
        await context.reply(`Stopped watching ${mint}.`);
      } catch (error) {
        await context.reply(apiMessage(error));
      }
    },
  };
}
