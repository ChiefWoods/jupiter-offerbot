import {
  CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR,
  getOfferEventV1Decoder,
  getOfferEventV2Decoder,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferEventV1,
  type OfferEventV2,
} from "jupiter-sdk/offerbook/kit";
import { z } from "zod";
import { hasPrefix, isSameBytes } from "./utils";

export { CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR, OFFERBOOK_PROGRAM_ADDRESS };

export const OfferCreatedSchema = z.object({
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  apy: z.number().int(),
  signature: z.string().min(1),
  slot: z.number().int().nonnegative(),
  listedAt: z.iso.datetime(),
});

export type OfferCreated = z.infer<typeof OfferCreatedSchema>;
type OfferEvent = OfferEventV1 | OfferEventV2;
const EVENT_CPI_WRAPPER_SIZE = 8;
const OFFER_CREATED_V1_DISCRIMINATOR = new Uint8Array([113, 118, 59, 240, 159, 129, 104, 196]);
const OFFER_CREATED_V2_DISCRIMINATOR = new Uint8Array([107, 228, 58, 148, 11, 235, 232, 181]);

export function isOfferCreationInstruction(data: Uint8Array): boolean {
  return isSameBytes(data.subarray(0, 8), CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR);
}

export function decodeOfferCreatedEvent(bytes: Uint8Array): OfferEvent | undefined {
  const eventData = bytes.subarray(EVENT_CPI_WRAPPER_SIZE);
  if (hasPrefix(eventData, OFFER_CREATED_V1_DISCRIMINATOR)) {
    return getOfferEventV1Decoder().decode(
      eventData.subarray(OFFER_CREATED_V1_DISCRIMINATOR.length),
    );
  }

  if (hasPrefix(eventData, OFFER_CREATED_V2_DISCRIMINATOR)) {
    return getOfferEventV2Decoder().decode(
      eventData.subarray(OFFER_CREATED_V2_DISCRIMINATOR.length),
    );
  }

  return undefined;
}

/**
 * Converts a supported Offerbook event to the API's exact-integer payload.
 * Offerbook events carry the creation time in Unix seconds, so no local clock
 * is used when deriving `listedAt`.
 */
export function normalizeOfferCreatedEvent(input: {
  event: OfferEvent;
  offerAddress: string;
  signature: string;
  slot: number;
}): OfferCreated | undefined {
  const collateral = input.event.collateral;

  // SPL tokens only
  if (collateral.__kind !== "Token") {
    return undefined;
  }

  return OfferCreatedSchema.parse({
    offerAddress: input.offerAddress,
    mint: collateral.fields[0].mint,
    apy: input.event.apy,
    signature: input.signature,
    slot: input.slot,
    // unix timestamp to milliseconds
    listedAt: new Date(Number(input.event.createdAt) * 1_000).toISOString(),
  });
}
