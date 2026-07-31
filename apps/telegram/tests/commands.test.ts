import { expect, test } from "bun:test";
import type { CommandContext, Context } from "grammy";
import { ApiClientError } from "../src/api";
import { createCommandHandlers } from "../src/commands";

const SOL_MINT = "So11111111111111111111111111111111111111112";

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
    },
    list: async () => [],
    update: async () => {},
    remove: async () => true,
  });
  const { ctx, replies } = context(`${SOL_MINT} 7.25`);

  await commands.watch(ctx);

  expect(requests).toEqual([{ platform: "telegram", userId: "99", mint: SOL_MINT, maxApy: 725 }]);
  expect(replies[0]).toContain("7.25%");
});

test("/watch omits an APY as an all-APY subscription", async () => {
  const requests: unknown[] = [];
  const commands = createCommandHandlers({
    create: async (input) => {
      requests.push(input);
    },
    list: async () => [],
    update: async () => {},
    remove: async () => true,
  });
  const { ctx } = context(SOL_MINT);

  await commands.watch(ctx);

  expect(requests).toEqual([{ platform: "telegram", userId: "99", mint: SOL_MINT, maxApy: null }]);
});

test("/list returns the user's watched mints", async () => {
  const commands = createCommandHandlers({
    create: async () => {},
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, maxApy: 725 }],
    update: async () => {},
    remove: async () => true,
  });
  const { ctx, replies } = context("");

  await commands.list(ctx);

  expect(replies).toEqual([`${SOL_MINT} — max 7.25%`]);
});

test("commands reject group chats before calling the API", async () => {
  let called = false;
  const commands = createCommandHandlers({
    create: async () => {
      called = true;
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
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, maxApy: 1100 }],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { ctx, replies } = context(`${SOL_MINT} 11.75`);

  await commands.watch(ctx);

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([`Updated ${SOL_MINT} to up to 11.75% APY.`]);
});

test("/update changes the APY of a watched mint", async () => {
  const updates: Array<{ id: string; maxApy: number | null }> = [];
  const commands = createCommandHandlers({
    create: async () => {},
    list: async () => [{ id: "subscription-1", mint: SOL_MINT, maxApy: 1100 }],
    update: async (id, maxApy) => {
      updates.push({ id, maxApy });
    },
    remove: async () => true,
  });
  const { ctx, replies } = context(`${SOL_MINT} 11.75`);

  await commands.update(ctx);

  expect(updates).toEqual([{ id: "subscription-1", maxApy: 1175 }]);
  expect(replies).toEqual([`Updated ${SOL_MINT} to up to 11.75% APY.`]);
});
