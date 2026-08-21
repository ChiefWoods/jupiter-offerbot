import {
  CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  CREATE_TOKEN_PRINCIPAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  getOfferEventV2Decoder,
  OFFER_CREATED_V2_DISCRIMINATOR,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferEventV2,
} from "jupiter-sdk/offerbook/web3js";
import { z } from "zod";
import { hasPrefix, isSameBytes } from "./utils";

export {
  CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  CREATE_TOKEN_PRINCIPAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  OFFERBOOK_PROGRAM_ADDRESS,
};

export const OfferTypeSchema = z.enum(["borrow", "lend"]);
export type OfferType = z.infer<typeof OfferTypeSchema>;

export const OfferCreatedSchema = z.object({
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  type: OfferTypeSchema,
  apy: z.number().int(),
  signature: z.string().min(1),
  slot: z.number().int().nonnegative(),
  listedAt: z.iso.datetime(),
});

export type OfferCreated = z.infer<typeof OfferCreatedSchema>;
const EVENT_CPI_WRAPPER_SIZE = 8;

export function getOfferCreationType(data: Uint8Array): OfferType | undefined {
  if (isSameBytes(data.subarray(0, 8), CREATE_TOKEN_PRINCIPAL_OFFER_INSTRUCTION_DISCRIMINATOR)) {
    return "borrow";
  }
  if (isSameBytes(data.subarray(0, 8), CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR)) {
    return "lend";
  }
  return undefined;
}

export function isOfferCreationInstruction(data: Uint8Array): boolean {
  return getOfferCreationType(data) !== undefined;
}

export function decodeOfferCreatedEvent(bytes: Uint8Array): OfferEventV2 | undefined {
  const eventData = bytes.subarray(EVENT_CPI_WRAPPER_SIZE);
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
  event: OfferEventV2;
  offerAddress: string;
  signature: string;
  slot: number;
  type: OfferType;
}): OfferCreated | undefined {
  const collateral = input.event.collateral;

  // SPL tokens only
  if (collateral.__kind !== "Token") {
    return undefined;
  }

  return OfferCreatedSchema.parse({
    offerAddress: input.offerAddress,
    mint: collateral.fields[0].mint.toBase58(),
    type: input.type,
    apy: input.event.apy,
    signature: input.signature,
    slot: input.slot,
    // unix timestamp to milliseconds
    listedAt: new Date(Number(input.event.createdAt) * 1_000).toISOString(),
  });
}
