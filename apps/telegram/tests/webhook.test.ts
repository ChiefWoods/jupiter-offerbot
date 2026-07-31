import { expect, test } from "bun:test";
import type { Api } from "grammy";
import { signWebhook } from "@jupiter-offerbot/common";
import { createWebhookHandler } from "../src/webhook";

const notification = {
  notificationId: "b5ac3a7c-63b9-40bd-8be2-0492db5f7e63",
  subscriptionId: "e118f8a4-282c-4174-a88e-3d2e9ae92b7b",
  userId: "99",
  offerAddress: "offer-address",
  mint: "So11111111111111111111111111111111111111112",
  apy: 725,
  signature: "transaction-signature",
  listedAt: "2026-07-28T00:00:00.000Z",
};

function botApi(onSendMessage: (chatId: string, text: string) => void = () => undefined): Api {
  return {
    sendMessage: async (chatId: string | number, text: string) => {
      onSendMessage(String(chatId), text);
      return {};
    },
  } as unknown as Api;
}

test("a valid signed delivery sends the notification to its Telegram user", async () => {
  const sent: Array<[string, string]> = [];
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(
    botApi((chatId, text) => sent.push([chatId, text])),
    "secret",
    () => now,
  );
  const body = JSON.stringify(notification);
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://telegram/internal/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-offerbot-timestamp": timestamp,
        "x-offerbot-signature": await signWebhook("secret", timestamp, body),
      },
      body,
    }),
  );

  expect(response.status).toBe(204);
  expect(sent).toEqual([["99", expect.stringContaining("7.25%")]]);
});

test("an unsigned delivery is rejected", async () => {
  const handler = createWebhookHandler(botApi(), "secret");

  const response = await handler(
    new Request("http://telegram/internal/notifications", {
      method: "POST",
      body: JSON.stringify(notification),
    }),
  );

  expect(response.status).toBe(401);
});

test("a signed malformed delivery is rejected as a bad request", async () => {
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(botApi(), "secret", () => now);
  const body = "not-json";
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://telegram/internal/notifications", {
      method: "POST",
      headers: {
        "x-offerbot-timestamp": timestamp,
        "x-offerbot-signature": await signWebhook("secret", timestamp, body),
      },
      body,
    }),
  );

  expect(response.status).toBe(400);
});
