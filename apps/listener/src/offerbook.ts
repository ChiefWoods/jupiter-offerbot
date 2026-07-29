import {
  CREATE_TOKEN_COLLATERAL_OFFER_DISCRIMINATOR,
  CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR,
  getOfferEventV0Decoder,
  getOfferEventV1Decoder,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferEventV0,
  type OfferEventV1,
} from "jupiter-sdk/offerbook/kit";
import { z } from "zod";
import { hasPrefix, isSameBytes } from "./utils";

export {
  CREATE_TOKEN_COLLATERAL_OFFER_DISCRIMINATOR,
  CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR,
  OFFERBOOK_PROGRAM_ADDRESS,
};
export type { OfferEventV0, OfferEventV1 };

export const OfferCreatedSchema = z.object({
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  apy: z.number().int(),
  signature: z.string().min(1),
  slot: z.number().int().nonnegative(),
  listedAt: z.iso.datetime(),
});

export type OfferCreated = z.infer<typeof OfferCreatedSchema>;
export type OfferbookEventName = "OfferCreated" | "OfferCreatedV1";

export type DecodedOfferbookEvent = {
  name: OfferbookEventName;
  data: OfferEventV0 | OfferEventV1;
};

// Not exported from jupiter-sdk/offerbook/kit.
const OFFER_CREATED_DISCRIMINATOR = new Uint8Array([31, 236, 215, 144, 75, 45, 157, 87]);
const OFFER_CREATED_V1_DISCRIMINATOR = new Uint8Array([113, 118, 59, 240, 159, 129, 104, 196]);

export function isOfferCreationInstruction(data: Uint8Array): boolean {
  const discriminator = data.subarray(0, 8);
  return (
    isSameBytes(discriminator, CREATE_TOKEN_COLLATERAL_OFFER_DISCRIMINATOR) ||
    isSameBytes(discriminator, CREATE_TOKEN_PRINCIPAL_OFFER_DISCRIMINATOR)
  );
}

/** Decodes the Anchor event payload emitted by the Offerbook program. */
export function decodeOfferbookEvent(bytes: Uint8Array): DecodedOfferbookEvent | undefined {
  const payload = bytes.subarray(8);

  if (hasPrefix(bytes, OFFER_CREATED_DISCRIMINATOR)) {
    return { name: "OfferCreated", data: getOfferEventV0Decoder().decode(payload) };
  }

  if (hasPrefix(bytes, OFFER_CREATED_V1_DISCRIMINATOR)) {
    return {
      name: "OfferCreatedV1",
      data: getOfferEventV1Decoder().decode(payload),
    };
  }

  return undefined;
}

/**
 * Converts a supported Offerbook event to the API's exact-integer payload.
 * Offerbook events carry the creation time in Unix seconds, so no local clock
 * is used when deriving `listedAt`.
 */
export function normalizeOfferCreatedEvent(input: {
  event: DecodedOfferbookEvent;
  offerAddress: string;
  signature: string;
  slot: number;
}): OfferCreated | undefined {
  const collateral = input.event.data.collateral;

  // SPL tokens only
  if (collateral.__kind !== "Token") {
    return undefined;
  }

  return OfferCreatedSchema.parse({
    offerAddress: input.offerAddress,
    mint: collateral.fields[0].mint,
    apy: input.event.data.apy,
    signature: input.signature,
    slot: input.slot,
    listedAt: new Date(Number(input.event.data.createdAt) * 1_000).toISOString(),
  });
}
