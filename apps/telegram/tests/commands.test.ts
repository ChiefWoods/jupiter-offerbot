import { expect, test } from "bun:test";
import type { CommandContext, Context } from "grammy";
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
    remove: async () => true,
  });
  const { ctx } = context(SOL_MINT);

  await commands.watch(ctx);

  expect(requests).toEqual([{ platform: "telegram", userId: "99", mint: SOL_MINT, maxApy: null }]);
});

test("commands reject group chats before calling the API", async () => {
  let called = false;
  const commands = createCommandHandlers({
    create: async () => {
      called = true;
    },
    list: async () => [],
    remove: async () => true,
  });
  const { ctx, replies } = context(SOL_MINT, "group");

  await commands.watch(ctx);

  expect(called).toBeFalse();
  expect(replies[0]).toContain("private chat");
});
