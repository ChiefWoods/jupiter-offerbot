import { expect, test } from "bun:test";
import { ApiClientError, type CreateSubscriptionInput } from "@jupiter-offerbot/channel";
import { MessageFlags } from "discord.js";
import { createCommandHandlers } from "../src/commands";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function createdSubscription(input: CreateSubscriptionInput) {
  return {
    id: "subscription-1",
    mint: input.mint,
    type: input.type,
    symbol: "SOL",
    maxApy: input.maxApy,
  };
}

function interaction(userId = "42") {
  const replies: Array<{ content: string; flags?: MessageFlags.Ephemeral }> = [];
  return {
    interaction: {
      user: { id: userId },
      reply: async (message: { content: string; flags?: MessageFlags.Ephemeral }) =>
        replies.push(message),
    },
    replies,
  };
}

test("/watch converts a decimal APY to its canonical integer for the invoking Discord user", async () => {
  const requests: unknown[] = [];
  const commands = createCommandHandlers({
    create: async (input) => {
      requests.push(input);
      return createdSubscription(input);
    },
    list: async () => [],
    update: async () => {},
    remove: async () => true,
  });
  const { interaction: command, replies } = interaction();

  await commands.watch(command, SOL_MINT, "borrow", "7.25");

  expect(requests).toEqual([
    { platform: "discord", userId: "42", mint: SOL_MINT, type: "borrow", maxApy: 725 },
  ]);
  expect(replies).toEqual([
    {
      content: "Borrow-offer alerts enabled for SOL (So11…1112), up to 7.25% APY.",
      flags: MessageFlags.Ephemeral,
    },
  ]);
});

test("/watch omits an APY as an all-APY subscription", async () => {
  const requests: unknown[] = [];
  const commands = createCommandHandlers({
    create: async (input) => {
      requests.push(input);
      return createdSubscription(input);
    },
    list: async () => [],
    update: async () => {},
    remove: async () => true,
  });
  const { interaction: command, replies } = interaction();

  await commands.watch(command, SOL_MINT, "lend", null);

  expect(requests).toEqual([
    { platform: "discord", userId: "42", mint: SOL_MINT, type: "lend", maxApy: null },
  ]);
  expect(replies).toEqual([
    {
      content: "Lend-offer alerts enabled for SOL (So11…1112), at any APY.",
      flags: MessageFlags.Ephemeral,
    },
  ]);
});

test("/list lists only the invoking user's subscriptions ephemerally", async () => {
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [
      { id: "subscription-1", mint: SOL_MINT, type: "borrow", symbol: "SOL", maxApy: 725 },
    ],
    update: async () => {},
    remove: async () => true,
  });
  const { interaction: command, replies } = interaction("42");

  await commands.list(command);

  expect(replies).toEqual([
    { content: `${SOL_MINT} (SOL) (borrow) — max 7.25%`, flags: MessageFlags.Ephemeral },
  ]);
});

test("/watch updates the APY when the mint is already watched", async () => {
  const updates: Array<{ id: string; maxApy: number | null }> = [];
  const commands = createCommandHandlers({
    create: async () => {
      throw new ApiClientError("SUBSCRIPTION_ALREADY_EXISTS");
    },
    list: async () => [
      { id: "subscription-1", mint: SOL_MINT, type: "borrow", symbol: "SOL", maxApy: 1100 },
    ],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { interaction: command, replies } = interaction();

  await commands.watch(command, SOL_MINT, "borrow", "11.75");

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([
    {
      content: "Borrow-offer alert updated for SOL (So11…1112): up to 11.75% APY.",
      flags: MessageFlags.Ephemeral,
    },
  ]);
});

test("/update changes the APY of a watched mint", async () => {
  const updates: Array<{ id: string; maxApy: number | null }> = [];
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [
      { id: "subscription-1", mint: SOL_MINT, type: "borrow", symbol: "SOL", maxApy: 1100 },
    ],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { interaction: command, replies } = interaction();

  await commands.update(command, SOL_MINT, "borrow", "11.75");

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([
    {
      content: "Borrow-offer alert updated for SOL (So11…1112): up to 11.75% APY.",
      flags: MessageFlags.Ephemeral,
    },
  ]);
});

test("/unwatch does not cancel another user's subscription", async () => {
  let removed = false;
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [],
    update: async () => {},
    remove: async () => {
      removed = true;
      return true;
    },
  });
  const { interaction: command, replies } = interaction("42");

  await commands.unwatch(command, SOL_MINT, "borrow");

  expect(removed).toBeFalse();
  expect(replies).toEqual([
    { content: "There is no subscription for that mint to cancel.", flags: MessageFlags.Ephemeral },
  ]);
});
