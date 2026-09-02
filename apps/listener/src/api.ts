import { createFetch } from "@better-fetch/fetch";
import type { AppType } from "@jupiter-offerbot/api/rpc";
import type { Logger } from "@jupiter-offerbot/logger";
import { hc } from "hono/client";
import { env } from "./env";
import { type OfferCreated } from "./offerbook";

const api = hc<AppType>(env.API_BASE_URL);
const OFFER_SUBMISSION_TIMEOUT_MS = 10_000;
const OFFER_SUBMISSION_RETRY_ATTEMPTS = 2;
const OFFER_SUBMISSION_RETRY_BASE_DELAY_MS = 250;
const OFFER_SUBMISSION_RETRY_MAX_DELAY_MS = 1_000;

const $fetch = createFetch({
  timeout: OFFER_SUBMISSION_TIMEOUT_MS,
  throw: true,
  retry: {
    type: "exponential",
    attempts: OFFER_SUBMISSION_RETRY_ATTEMPTS,
    baseDelay: OFFER_SUBMISSION_RETRY_BASE_DELAY_MS,
    maxDelay: OFFER_SUBMISSION_RETRY_MAX_DELAY_MS,
    shouldRetry: (response) => response !== null && [502, 503, 504].includes(response.status),
  },
});

export async function submitOffer(offer: OfferCreated, logger: Logger): Promise<void> {
  try {
    await $fetch(api.v1.offers.$url().toString(), {
      method: "POST",
      body: offer,
      auth: { type: "Bearer", token: env.LISTENER_API_TOKEN },
      onRetry: ({ request, response }) => {
        logger.warn("Retrying Offerbook offer submission", {
          offerAddress: offer.offerAddress,
          slot: offer.slot,
          listedAt: offer.listedAt,
          signature: offer.signature,
          attempt: (request.retryAttempt ?? 0) + 1,
          status: response.status,
        });
      },
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
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

  logger.info("Submitted Offerbook offer", {
    offerAddress: offer.offerAddress,
    slot: offer.slot,
    listedAt: offer.listedAt,
    signature: offer.signature,
  });
}
