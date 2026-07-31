import { expect, test } from "bun:test";
import { ApiClientError, type CreateSubscriptionInput } from "@jupiter-offerbot/channel";
import type { CommandContext, Context } from "grammy";
import { createCommandHandlers } from "../src/commands";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function createdSubscription(input: CreateSubscriptionInput) {
  return { id: "subscription-1", mint: input.mint, symbol: "SOL", maxApy: input.maxApy };
}

function context(text: string, chatType: "private" | "group" = "private") {
  const replies: string[] = [];
  return {
    ctx: {
      chat: { type: chatType },
      from: { id: 99 },
      match: text,
      reply: async (message: string) => {
        replies.push(message);
      },
    } as unknown as CommandContext<Context>,
    replies,
  };
}

test("/watch converts a decimal APY to its canonical integer", async () => {
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
  const { ctx, replies } = context(`${SOL_MINT} 7.25`);

  await commands.watch(ctx);

  expect(requests).toEqual([{ platform: "telegram", userId: "99", mint: SOL_MINT, maxApy: 725 }]);
  expect(replies).toEqual([`Watching ${SOL_MINT} (SOL) at up to 7.25% APY.`]);
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
  const { ctx, replies } = context(SOL_MINT);

  await commands.watch(ctx);

  expect(requests).toEqual([{ platform: "telegram", userId: "99", mint: SOL_MINT, maxApy: null }]);
  expect(replies).toEqual([`Watching ${SOL_MINT} (SOL) at any APY.`]);
});

test("/list returns the user's watched mints", async () => {
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, symbol: "SOL", maxApy: 725 }],
    update: async () => {},
    remove: async () => true,
  });
  const { ctx, replies } = context("");

  await commands.list(ctx);

  expect(replies).toEqual([`${SOL_MINT} (SOL) — max 7.25%`]);
});

test("commands reject group chats before calling the API", async () => {
  let called = false;
  const commands = createCommandHandlers({
    create: async () => {
      called = true;
      return createdSubscription({
        platform: "telegram",
        userId: "99",
        mint: SOL_MINT,
        maxApy: null,
      });
    },
    list: async () => [],
    update: async () => {},
    remove: async () => true,
  });
  const { ctx, replies } = context(SOL_MINT, "group");

  await commands.watch(ctx);

  expect(called).toBeFalse();
  expect(replies[0]).toContain("private chat");
});

test("/watch updates the APY when the mint is already watched", async () => {
  const updates: Array<{ id: string; maxApy: number | null }> = [];
  const commands = createCommandHandlers({
    create: async () => {
      throw new ApiClientError("SUBSCRIPTION_ALREADY_EXISTS");
    },
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, symbol: "SOL", maxApy: 1100 }],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { ctx, replies } = context(`${SOL_MINT} 11.75`);

  await commands.watch(ctx);

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([`Updated ${SOL_MINT} (SOL) to up to 11.75% APY.`]);
});

test("/update changes the APY of a watched mint", async () => {
  const updates: Array<{ id: string; maxApy: number | null }> = [];
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, symbol: "SOL", maxApy: 1100 }],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { ctx, replies } = context(`${SOL_MINT} 11.75`);

  await commands.update(ctx);

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([`Updated ${SOL_MINT} (SOL) to up to 11.75% APY.`]);
});

test("/unwatch does not remove a subscription for a different mint", async () => {
  let removed = false;
  const commands = createCommandHandlers({
    create: async (input) => createdSubscription(input),
    list: async () => [{ id: "subscription-1", mint: "other-mint", symbol: null, maxApy: null }],
    update: async () => {},
    remove: async () => {
      removed = true;
      return true;
    },
  });
  const { ctx, replies } = context(SOL_MINT);

  await commands.unwatch(ctx);

  expect(removed).toBeFalse();
  expect(replies).toEqual(["There is no subscription for that mint to cancel."]);
});
