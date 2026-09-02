import { hc } from "hono/client";
import type { AppType } from "@jupiter-offerbot/api/rpc";
import type { Logger } from "@jupiter-offerbot/logger";
import { env } from "./env";
import { type OfferCreated } from "./offerbook";

const api = hc<AppType>(env.API_BASE_URL);
const OFFER_SUBMISSION_TIMEOUT_MS = 10_000;

export function requestWithTimeout<T>(
  request: (signal: AbortSignal) => Promise<T>,
  timeoutMs = OFFER_SUBMISSION_TIMEOUT_MS,
): Promise<T> {
  return request(AbortSignal.timeout(timeoutMs));
}

export async function submitOffer(offer: OfferCreated, logger: Logger): Promise<void> {
  let response: Awaited<ReturnType<typeof api.v1.offers.$post>>;

  try {
    response = await requestWithTimeout((signal) =>
      api.v1.offers.$post(
        { json: offer },
        {
          headers: { authorization: `Bearer ${env.LISTENER_API_TOKEN}` },
          init: { signal },
        },
      ),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      logger.warn("Offerbook offer submission timed out", {
        offerAddress: offer.offerAddress,
        slot: offer.slot,
        listedAt: offer.listedAt,
        signature: offer.signature,
        timeoutMs: OFFER_SUBMISSION_TIMEOUT_MS,
      });
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`offer ingestion failed with HTTP ${response.status}`);
  }

  logger.info("Submitted Offerbook offer", {
    offerAddress: offer.offerAddress,
    slot: offer.slot,
    listedAt: offer.listedAt,
    signature: offer.signature,
  });
}
