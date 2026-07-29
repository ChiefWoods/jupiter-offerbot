import { env } from "./env";
import { type OfferCreated } from "./offerbook";

export async function submitOffer(offer: OfferCreated): Promise<void> {
  const response = await fetch(`${env.API_BASE_URL}/offers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${env.LISTENER_API_TOKEN}`,
    },
    body: JSON.stringify(offer),
  });

  if (!response.ok) {
    throw new Error(`Offer ingestion failed with HTTP ${response.status}`);
  }

  console.info(
    JSON.stringify({
      message: "Submitted Offerbook offer",
      offerAddress: offer.offerAddress,
      slot: offer.slot,
    }),
  );
}
