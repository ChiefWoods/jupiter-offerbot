import { expect, test } from "bun:test";
import type { Logger } from "@jupiter-offerbot/logger";

const attempts: number[] = [];

process.env.GRPC_ENDPOINT ??= "http://localhost:10000";
process.env.SOLANA_RPC_URL ??= "http://localhost:8899";
process.env.API_BASE_URL = "http://listener.test";
process.env.LISTENER_API_TOKEN ??= "listener-token";

const { submitOffer } = await import("../src/api");

test("retries a transient offer submission failure with exponential backoff", async () => {
  const fetch = globalThis.fetch;
  const warnings: Array<{ message: string; fields: Record<string, unknown> | undefined }> = [];
  const logger: Logger = {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (message, fields) => warnings.push({ message, fields }),
    error: () => {},
    fatal: () => {},
  };

  globalThis.fetch = (async () => {
    attempts.push(Date.now());
    return new Response(null, { status: attempts.length < 3 ? 503 : 201 });
  }) as unknown as typeof fetch;

  try {
    await submitOffer(
      {
        offerAddress: "offer-address",
        slot: 123,
        listedAt: "2025-07-25T00:00:00.000Z",
        signature: "signature",
        mint: "mint",
        type: "borrow",
        apy: 700,
      },
      logger,
    );
  } finally {
    globalThis.fetch = fetch;
  }

  expect(attempts).toHaveLength(3);
  expect(warnings).toHaveLength(2);
  expect(warnings.every(({ message }) => message === "Retrying Offerbook offer submission")).toBe(
    true,
  );
});
