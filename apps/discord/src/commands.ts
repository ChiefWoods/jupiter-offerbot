import { isAddress } from "@solana/kit";
import {
  ApiClientError,
  formatApy,
  formatMint,
  formatSubscriptionAsset,
  parseDisplayApy,
  type SubscriptionApi,
  type SubscriptionType,
} from "@jupiter-offerbot/channel";
import { MessageFlags } from "discord.js";

type CommandInteraction = {
  user: { id: string };
  reply(message: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>;
};

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

function ephemeral(interaction: CommandInteraction, content: string) {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function parseApy(maxApyText: string | null): number | null | undefined {
  if (maxApyText === null) return null;
  return parseDisplayApy(maxApyText) ?? undefined;
}

export function createCommandHandlers(api: SubscriptionApi) {
  const validate = async (
    interaction: CommandInteraction,
    mint: string,
    maxApyText: string | null,
  ) => {
    if (!isAddress(mint)) {
      await ephemeral(interaction, "Provide a valid Solana mint address.");
      return undefined;
    }
    const maxApy = parseApy(maxApyText);
    if (maxApy === undefined) {
      await ephemeral(
        interaction,
        "APY must be a non-negative number with at most two decimal places, for example 7.25.",
      );
      return undefined;
    }
    return maxApy;
  };

  return {
    async offerbot(interaction: CommandInteraction) {
      await ephemeral(
        interaction,
        [
          "Welcome to Offerbot!",
          "",
          "Commands:",
          "/list — list your watched mints",
          "/watch mint:<base58> type:<borrow|lend> max_apy:<decimal optional> — add or update a watch",
          "/update mint:<base58> type:<borrow|lend> max_apy:<decimal optional> — update a watch",
          "/unwatch mint:<base58> type:<borrow|lend> — cancel a watch",
        ].join("\n"),
      );
    },
    async list(interaction: CommandInteraction) {
      try {
        const subscriptions = await api.list(interaction.user.id);
        if (!subscriptions.length) {
          await ephemeral(interaction, "You are not watching any mints yet. Use /watch to begin.");
          return;
        }
        await ephemeral(
          interaction,
          subscriptions
            .map(
              (subscription) =>
                `${formatMint(subscription.mint, subscription.symbol)} (${subscription.type}) — ${subscription.maxApy === null ? "any%" : `max ${formatApy(subscription.maxApy)}`}`,
            )
            .join("\n\n"),
        );
      } catch (error) {
        await ephemeral(interaction, apiMessage(error));
      }
    },
    async watch(
      interaction: CommandInteraction,
      mint: string,
      type: SubscriptionType,
      maxApyText: string | null,
    ) {
      const maxApy = await validate(interaction, mint, maxApyText);
      if (maxApy === undefined) return;
      try {
        const subscription = await api.create({
          platform: "discord",
          userId: interaction.user.id,
          mint,
          type,
          maxApy,
        });
        await ephemeral(
          interaction,
          `${type === "borrow" ? "Borrow" : "Lend"}-offer alerts enabled for ${formatSubscriptionAsset(mint, subscription.symbol)}, ${maxApy === null ? "at any APY" : `up to ${formatApy(maxApy)} APY`}.`,
        );
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "SUBSCRIPTION_ALREADY_EXISTS") {
          try {
            const subscription = (await api.list(interaction.user.id)).find(
              (item) => item.mint === mint && item.type === type,
            );
            if (!subscription) throw error;
            await api.update(subscription.id, maxApy);
            await ephemeral(
              interaction,
              `${type === "borrow" ? "Borrow" : "Lend"}-offer alert updated for ${formatSubscriptionAsset(mint, subscription.symbol)}: ${maxApy === null ? "any APY" : `up to ${formatApy(maxApy)} APY`}.`,
            );
          } catch (updateError) {
            await ephemeral(interaction, apiMessage(updateError));
          }
          return;
        }
        await ephemeral(interaction, apiMessage(error));
      }
    },
    async update(
      interaction: CommandInteraction,
      mint: string,
      type: SubscriptionType,
      maxApyText: string | null,
    ) {
      const maxApy = await validate(interaction, mint, maxApyText);
      if (maxApy === undefined) return;
      try {
        const subscription = (await api.list(interaction.user.id)).find(
          (item) => item.mint === mint && item.type === type,
        );
        if (!subscription) {
          await ephemeral(interaction, "You are not watching that mint.");
          return;
        }
        await api.update(subscription.id, maxApy);
        await ephemeral(
          interaction,
          `${type === "borrow" ? "Borrow" : "Lend"}-offer alert updated for ${formatSubscriptionAsset(mint, subscription.symbol)}: ${maxApy === null ? "any APY" : `up to ${formatApy(maxApy)} APY`}.`,
        );
      } catch (error) {
        await ephemeral(interaction, apiMessage(error));
      }
    },
    async unwatch(interaction: CommandInteraction, mint: string, type: SubscriptionType) {
      if (!isAddress(mint)) {
        await ephemeral(interaction, "Provide a valid Solana mint address.");
        return;
      }
      try {
        const subscription = (await api.list(interaction.user.id)).find(
          (item) => item.mint === mint && item.type === type,
        );
        if (!subscription || !(await api.remove(subscription.id))) {
          await ephemeral(interaction, "There is no subscription for that mint to cancel.");
          return;
        }
        await ephemeral(
          interaction,
          `${type === "borrow" ? "Borrow" : "Lend"}-offer alerts disabled for ${formatSubscriptionAsset(mint, subscription.symbol)}.`,
        );
      } catch (error) {
        await ephemeral(interaction, apiMessage(error));
      }
    },
  };
}
