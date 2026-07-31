import { expect, test } from "bun:test";
import { signWebhook } from "@jupiter-offerbot/common";
import { createWebhookHandler } from "../src/webhook";

const notification = {
  notificationId: "b5ac3a7c-63b9-40bd-8be2-0492db5f7e63",
  subscriptionId: "e118f8a4-282c-4174-a88e-3d2e9ae92b7b",
  userId: "42",
  offerAddress: "offer-address",
  mint: "So11111111111111111111111111111111111111112",
  apy: 725,
  signature: "transaction-signature",
  listedAt: "2026-07-28T00:00:00.000Z",
};

test("a valid signed Discord delivery sends a direct message to its envelope user", async () => {
  const sent: string[] = [];
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(
    {
      users: {
        fetch: async (id: string) => ({ send: async (text: string) => sent.push(`${id}:${text}`) }),
      },
    },
    "secret",
    () => now,
  );
  const body = JSON.stringify(notification);
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://discord/internal/notifications", {
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
  expect(sent).toEqual([expect.stringContaining("42:New offer listed!")]);
  expect(sent[0]).toContain("7.25%");
});

test("rejects an unsigned Discord delivery", async () => {
  const handler = createWebhookHandler(
    { users: { fetch: async () => ({ send: async () => {} }) } },
    "secret",
  );

  const response = await handler(
    new Request("http://discord/internal/notifications", {
      method: "POST",
      body: JSON.stringify(notification),
    }),
  );

  expect(response.status).toBe(401);
});

test("rejects a signed malformed Discord delivery as a bad request", async () => {
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(
    { users: { fetch: async () => ({ send: async () => {} }) } },
    "secret",
    () => now,
  );
  const body = "not-json";
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://discord/internal/notifications", {
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

test("returns not found when the Discord user cannot receive direct messages", async () => {
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(
    {
      users: {
        fetch: async () => {
          throw { code: 50007 };
        },
      },
    },
    "secret",
    () => now,
  );
  const body = JSON.stringify(notification);
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://discord/internal/notifications", {
      method: "POST",
      headers: {
        "x-offerbot-timestamp": timestamp,
        "x-offerbot-signature": await signWebhook("secret", timestamp, body),
      },
      body,
    }),
  );

  expect(response.status).toBe(404);
});

test("returns bad gateway when generic Discord delivery fails", async () => {
  const now = 1_800_000_000_000;
  const handler = createWebhookHandler(
    {
      users: {
        fetch: async () => {
          throw new Error("Discord unavailable");
        },
      },
    },
    "secret",
    () => now,
  );
  const body = JSON.stringify(notification);
  const timestamp = String(now / 1_000);

  const response = await handler(
    new Request("http://discord/internal/notifications", {
      method: "POST",
      headers: {
        "x-offerbot-timestamp": timestamp,
        "x-offerbot-signature": await signWebhook("secret", timestamp, body),
      },
      body,
    }),
  );

  expect(response.status).toBe(502);
});
