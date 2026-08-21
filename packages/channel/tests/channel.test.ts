import { expect, test } from "bun:test";
import { signWebhook } from "@jupiter-offerbot/common";
import {
  createChannelApp,
  createSubscriptionApi,
  formatApy,
  parseDisplayApy,
  parseNotificationRequest,
  renderNotification,
} from "../src";

const notification = {
  notificationId: "b5ac3a7c-63b9-40bd-8be2-0492db5f7e63",
  subscriptionId: "e118f8a4-282c-4174-a88e-3d2e9ae92b7b",
  userId: "42",
  offerAddress: "offer-address",
  mint: "So11111111111111111111111111111111111111112",
  symbol: "SOL",
  type: "borrow",
  apy: 725,
  signature: "transaction-signature",
  listedAt: "2026-07-28T00:00:00.000Z",
};

async function withMockedFetch<T>(send: typeof fetch, callback: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = send;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("converts APY display values to integer hundredths and back", () => {
  expect(parseDisplayApy("7.25")).toBe(725);
  expect(parseDisplayApy("7.256")).toBeNull();
  expect(formatApy(725)).toBe("7.25%");
});

test("binds subscription list requests to the configured channel", async () => {
  const requests: Request[] = [];
  const send = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(
      input instanceof Request ? new Request(input, init) : new Request(String(input), init),
    );
    return Response.json({ subscriptions: [] });
  }) as unknown as typeof fetch;
  await withMockedFetch(send, async () => {
    const api = createSubscriptionApi("http://api.example", "secret", "discord");
    await api.list("42");
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe("http://api.example/v1/subscriptions?platform=discord&userId=42");
  expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret");
});

test("retries a transient subscription-service failure", async () => {
  let attempts = 0;
  const send = (async () => {
    attempts++;
    return attempts === 1
      ? new Response(null, { status: 503 })
      : Response.json({ subscriptions: [] });
  }) as unknown as typeof fetch;
  await withMockedFetch(send, async () => {
    const api = createSubscriptionApi("http://api.example", "secret", "telegram");
    await expect(api.list("42")).resolves.toEqual([]);
  });

  expect(attempts).toBe(2);
});

test("parses and renders a valid signed notification", async () => {
  const now = 1_800_000_000_000;
  const body = JSON.stringify(notification);
  const timestamp = String(now / 1_000);
  const parsed = await parseNotificationRequest(
    new Request("http://bridge", {
      method: "POST",
      headers: {
        "x-offerbot-timestamp": timestamp,
        "x-offerbot-signature": await signWebhook("secret", timestamp, body),
      },
      body,
    }),
    "secret",
    () => now,
  );

  expect("notification" in parsed).toBeTrue();
  if ("notification" in parsed)
    expect(renderNotification(parsed.notification)).toEqual({
      message: `New borrow offer

SOL (So11…1112)
APY: 7.25%`,
      offerUrl: `https://offerbook.jup.ag/tokens/borrow?offerId=${notification.offerAddress}`,
    });
});

test("renders lend notifications with the lend offerbook URL", () => {
  expect(renderNotification({ ...notification, type: "lend" })).toEqual({
    message: `New lend offer

SOL (So11…1112)
APY: 7.25%`,
    offerUrl: `https://offerbook.jup.ag/tokens/lend?offerId=${notification.offerAddress}`,
  });
});

test("rejects an unsigned notification before delivery", async () => {
  const parsed = await parseNotificationRequest(new Request("http://bridge"), "secret");

  expect("response" in parsed).toBeTrue();
  if ("response" in parsed) expect(parsed.response.status).toBe(401);
});

test("exposes the standard health and not-found contracts", async () => {
  const app = createChannelApp(async () => new Response(null, { status: 204 }), ["*"]);

  expect(await (await app.request("/health")).json()).toEqual({ ok: true });
  expect((await app.request("/missing")).status).toBe(404);
});
