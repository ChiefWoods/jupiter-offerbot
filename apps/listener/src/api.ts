import { hc } from "hono/client";
import type { AppType } from "@jupiter-offerbot/api/rpc";
import type { Logger } from "@jupiter-offerbot/logger";
import { env } from "./env";
import { type OfferCreated } from "./offerbook";

const api = hc<AppType>(env.API_BASE_URL);

type RetryableResponse = {
  headers: Headers;
  ok: boolean;
  status: number;
};

function getRetryAfterMs(response: RetryableResponse): number {
  const retryAfterSeconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
    ? retryAfterSeconds * 1_000
    : 1_000;
}

function abortError(): DOMException {
  return new DOMException("Offer submission aborted", "AbortError");
}

async function sleepUntilRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(abortError());
      },
      { once: true },
    );
  });
}

export async function retryRateLimitedRequest<T extends RetryableResponse>(
  request: () => Promise<T>,
  sleep: (delayMs: number) => Promise<void> = (delayMs) => Bun.sleep(delayMs),
  onRateLimited?: (retryInMs: number) => void,
): Promise<T> {
  while (true) {
    const response = await request();
    if (response.status !== 429) return response;

    const retryInMs = getRetryAfterMs(response);
    onRateLimited?.(retryInMs);
    await sleep(retryInMs);
  }
}

export async function submitOffer(
  offer: OfferCreated,
  logger: Logger,
  signal: AbortSignal,
): Promise<void> {
  const response = await retryRateLimitedRequest(
    () =>
      api.v1.offers.$post(
        { json: offer },
        { headers: { authorization: `Bearer ${env.LISTENER_API_TOKEN}` } },
      ),
    (delayMs) => sleepUntilRetry(delayMs, signal),
    (retryInMs) =>
      logger.warn("Offer ingestion rate-limited; retrying", {
        offerAddress: offer.offerAddress,
        slot: offer.slot,
        retryInMs,
      }),
  );

  if (!response.ok) {
    throw new Error(`offer ingestion failed with HTTP ${response.status}`);
  }

  logger.info("Submitted Offerbook offer", {
    offerAddress: offer.offerAddress,
    slot: offer.slot,
  });
}
