import { hc } from "hono/client";
import type { AppType } from "@jupiter-offerbot/api/rpc";
import { env } from "./env";
import { type OfferCreated } from "./offerbook";

const api = hc<AppType>(env.API_BASE_URL);

export async function submitOffer(offer: OfferCreated): Promise<void> {
  const response = await api.v1.offers.$post(
    { json: offer },
    { headers: { authorization: `Bearer ${env.LISTENER_API_TOKEN}` } },
  );

  if (!response.ok) {
    throw new Error(`offer ingestion failed with HTTP ${response.status}`);
  }

  console.info(
    JSON.stringify({
      message: "Submitted Offerbook offer",
      offerAddress: offer.offerAddress,
      slot: offer.slot,
    }),
  );
}
