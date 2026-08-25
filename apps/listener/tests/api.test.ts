import { expect, test } from "bun:test";

process.env.GRPC_ENDPOINT ??= "http://localhost:10000";
process.env.SOLANA_RPC_URL ??= "http://localhost:8899";
process.env.API_BASE_URL ??= "http://localhost:3000";
process.env.LISTENER_API_TOKEN ??= "listener-token";

const { retryRateLimitedRequest } = await import("../src/api");

test("retries a rate-limited offer request after its Retry-After delay", async () => {
  let attempts = 0;
  const delays: number[] = [];

  const response = await retryRateLimitedRequest(
    async () => {
      attempts += 1;
      return attempts === 1
        ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
        : new Response(null, { status: 202 });
    },
    async (delayMs) => {
      delays.push(delayMs);
    },
  );

  expect(response.status).toBe(202);
  expect(attempts).toBe(2);
  expect(delays).toEqual([2_000]);
});
