import {
  CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR,
  getOfferEventV1Decoder,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferEventV1,
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
const EVENT_CPI_WRAPPER_SIZE = 8;
const OFFER_CREATED_V1_DISCRIMINATOR = new Uint8Array([113, 118, 59, 240, 159, 129, 104, 196]);

export function isOfferCreationInstruction(data: Uint8Array): boolean {
  return isSameBytes(data.subarray(0, 8), CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR);
}

export function decodeOfferCreatedV1(bytes: Uint8Array): OfferEventV1 | undefined {
  if (hasPrefix(bytes.subarray(EVENT_CPI_WRAPPER_SIZE), OFFER_CREATED_V1_DISCRIMINATOR)) {
    return getOfferEventV1Decoder().decode(
      bytes.subarray(EVENT_CPI_WRAPPER_SIZE + OFFER_CREATED_V1_DISCRIMINATOR.length),
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
  event: OfferEventV1;
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
