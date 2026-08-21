import { expect, test } from "bun:test";
import type { SubscriptionRecord } from "@jupiter-offerbot/prisma";
import type { ApiDependencies } from "../src/main";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/offerbot_test";
process.env.JUPITER_API_KEY ??= "jupiter-key";
process.env.JUPITER_API_URL ??= "https://api.jup.ag/tokens/v2";
process.env.LISTENER_API_TOKEN ??= "listener-token";
process.env.DISCORD_BRIDGE_TOKEN ??= "discord-token";
process.env.TELEGRAM_BRIDGE_TOKEN ??= "telegram-token";
process.env.MAX_SUBSCRIPTIONS_PER_USER ??= "2";
process.env.REDIS_URL ??= "redis://localhost:6379";

const { createApp, createReadinessCheck } = await import("../src/main");

const SOL_MINT = "So11111111111111111111111111111111111111112";

function dependencies(): ApiDependencies {
  const subscriptions: SubscriptionRecord[] = [];
  const jobs: Array<Record<string, unknown>> = [];
  return {
    bridgeTokens: { discord: "discord-token", telegram: "telegram-token" },
    listenerToken: "listener-token",
    allowedOrigins: [],
    rateLimit: async (_c, next) => next(),
    subscriptions: {
      async create(input) {
        if (
          subscriptions.some(
            (row) =>
              row.platform === input.platform &&
              row.userId === input.userId &&
              row.mint === input.mint &&
              row.type === input.type,
          )
        )
          throw new Error("unique");
        if (
          subscriptions.filter(
            (row) => row.platform === input.platform && row.userId === input.userId,
          ).length >= 2
        )
          throw new Error("limit");
        const subscription = {
          id: crypto.randomUUID(),
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
          symbol: null,
        };
        subscriptions.push(subscription);
        return subscription;
      },
      async list(platform, userId) {
        return subscriptions.filter((row) => row.platform === platform && row.userId === userId);
      },
      async update(id, platform, update) {
        const row = subscriptions.find((item) => item.id === id && item.platform === platform);
        if (!row) return null;
        Object.assign(row, update, { updatedAt: new Date() });
        return row;
      },
      async delete(id, platform) {
        const index = subscriptions.findIndex((row) => row.id === id && row.platform === platform);
        if (index < 0) return false;
        subscriptions.splice(index, 1);
        return true;
      },
    },
    offers: {
      async ingest(offer) {
        const recipients = subscriptions.filter(
          (row) =>
            row.mint === offer.mint &&
            row.type === offer.type &&
            (row.maxApy === null || (row.maxApy as number) >= offer.apy),
        );
        let queued = 0;
        for (const subscription of recipients) {
          if (
            !jobs.some(
              (job) =>
                job.subscriptionId === subscription.id && job.offerAddress === offer.offerAddress,
            )
          ) {
            jobs.push({ subscriptionId: subscription.id, offerAddress: offer.offerAddress });
            queued++;
          }
        }
        return { accepted: true, duplicate: queued === 0, queued };
      },
    },
  };
}

function request(app: ReturnType<typeof createApp>, platform = "discord") {
  return (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: {
        authorization: `Bearer ${platform}-token`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
}

test("readiness waits for both Postgres and Redis", async () => {
  const checks: string[] = [];
  const ready = createReadinessCheck(
    async () => {
      checks.push("postgres");
    },
    async () => {
      checks.push("redis");
    },
  );

  await ready();

  expect(checks.sort()).toEqual(["postgres", "redis"]);
});

test("readiness fails when Redis is unavailable", async () => {
  const ready = createReadinessCheck(
    async () => undefined,
    async () => {
      throw new Error("Redis unavailable");
    },
  );

  await expect(ready()).rejects.toThrow("Redis unavailable");
});

test("creates and lists a bridge platform user's subscriptions", async () => {
  const app = createApp(dependencies());
  const api = request(app);
  expect(
    (
      await api("/v1/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          platform: "discord",
          userId: "42",
          mint: SOL_MINT,
          type: "borrow",
          maxApy: 700,
        }),
      })
    ).status,
  ).toBe(201);
  const response = await api("/v1/subscriptions?platform=discord&userId=42");
  expect(await response.json()).toMatchObject({
    subscriptions: [{ type: "borrow", maxApy: 700, symbol: null }],
  });
});

test("allows separate borrow and lend subscriptions for the same mint and matches only their type", async () => {
  const app = createApp(dependencies());
  const api = request(app);
  for (const type of ["borrow", "lend"] as const) {
    const response = await api("/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        platform: "discord",
        userId: "42",
        mint: SOL_MINT,
        type,
        maxApy: null,
      }),
    });
    expect(response.status).toBe(201);
  }

  const ingest = (type: "borrow" | "lend") =>
    app.request("/v1/offers", {
      method: "POST",
      headers: { authorization: "Bearer listener-token", "content-type": "application/json" },
      body: JSON.stringify({
        offerAddress: `${type}-offer`,
        mint: SOL_MINT,
        type,
        apy: 700,
        signature: "signature",
        slot: 1,
        listedAt: "2026-07-28T00:00:00.000Z",
      }),
    });

  expect(await (await ingest("borrow")).json()).toMatchObject({ queued: 1 });
  expect(await (await ingest("lend")).json()).toMatchObject({ queued: 1 });
});

test("rejects a bridge attempting to manage another platform", async () => {
  const app = createApp(dependencies());
  const response = await request(app)("/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      platform: "telegram",
      userId: "42",
      mint: SOL_MINT,
      type: "borrow",
      maxApy: null,
    }),
  });
  expect(response.status).toBe(403);
});

test("enforces the configured subscription limit", async () => {
  const app = createApp(dependencies());
  const api = request(app);
  for (const mint of [SOL_MINT, "Es9vMFrzaCERmJfrF4H2FYD3LVdaPUFe1n2hCyjGwV58"])
    await api("/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        platform: "discord",
        userId: "42",
        mint,
        type: "borrow",
        maxApy: null,
      }),
    });
  const response = await api("/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      platform: "discord",
      userId: "42",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      type: "borrow",
      maxApy: null,
    }),
  });
  expect(response.status).toBe(429);
});

test("matches integer APY subscriptions and makes offer replay idempotent", async () => {
  const app = createApp(dependencies());
  const api = request(app);
  for (const [userId, maxApy] of [
    ["all", null],
    ["equal", 700],
    ["low", 699],
  ] as const)
    await api("/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify({ platform: "discord", userId, mint: SOL_MINT, type: "borrow", maxApy }),
    });
  const event = {
    offerAddress: "offer",
    mint: SOL_MINT,
    type: "borrow",
    apy: 700,
    signature: "signature",
    slot: 1,
    listedAt: "2026-07-28T00:00:00.000Z",
  };
  const ingest = (body: object) =>
    app.request("/v1/offers", {
      method: "POST",
      headers: { authorization: "Bearer listener-token", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect(await (await ingest(event)).json()).toMatchObject({ queued: 2, duplicate: false });
  expect(await (await ingest(event)).json()).toMatchObject({ queued: 0, duplicate: true });
});

test("applies CORS and request IDs before API routes", async () => {
  const app = createApp({ ...dependencies(), allowedOrigins: ["https://bridge.example"] });
  const response = await app.request("/health", { headers: { origin: "https://bridge.example" } });
  expect(response.headers.get("access-control-allow-origin")).toBe("https://bridge.example");
  expect(response.headers.get("x-request-id")).toBeTruthy();
});

test("returns the standard not-found response", async () => {
  const response = await createApp(dependencies()).request("/missing");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "NOT_FOUND", message: "Route not found." },
  });
});

test("returns the standard unexpected-error response with a request ID", async () => {
  const app = createApp({
    ...dependencies(),
    offers: {
      async ingest() {
        throw new Error("unexpected");
      },
    },
  });
  const response = await app.request("/v1/offers", {
    method: "POST",
    headers: { authorization: "Bearer listener-token", "content-type": "application/json" },
    body: JSON.stringify({
      offerAddress: "offer",
      mint: SOL_MINT,
      type: "borrow",
      apy: 700,
      signature: "sig",
      slot: 1,
      listedAt: "2026-07-28T00:00:00.000Z",
    }),
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    meta: { requestId: expect.any(String) },
  });
});
