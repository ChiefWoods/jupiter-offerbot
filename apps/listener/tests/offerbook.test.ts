import { expect, test } from "bun:test";
import {
  getOfferEventV0Encoder,
  getOfferEventV1Encoder,
  OfferSide,
  OfferStatus,
  type OfferEventV0Args,
} from "jupiter-sdk/offerbook/kit";
import { address } from "@solana/kit";

import { decodeOfferbookEvent, normalizeOfferCreatedEvent } from "../src/offerbook";

const SOL_MINT = address("So11111111111111111111111111111111111111112");
const TOKEN_PROGRAM = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const CREATOR = address("11111111111111111111111111111111");

function eventData(version: "v0" | "v1"): Uint8Array {
  const common: OfferEventV0Args = {
    creator: CREATOR,
    side: OfferSide.Principal,
    status: OfferStatus.Active,
    principal: { __kind: "None" },
    collateral: {
      __kind: "Token",
      fields: [{ mint: SOL_MINT, tokenProgram: TOKEN_PROGRAM }],
    },
    filter: { __kind: "None" },
    principalAmount: 1n,
    remainingPrincipal: 1n,
    collateralAmount: 1n,
    remainingCollateral: 1n,
    apy: 700,
    duration: 1,
    createdAt: 1_753_401_600n,
    expiredAt: 0n,
    updatedAt: 0n,
    minFillAmount: 1n,
    fillCounter: 0n,
    allowPartialFill: 0,
    bump: 255,
  };
  const discriminator =
    version === "v0"
      ? new Uint8Array([31, 236, 215, 144, 75, 45, 157, 87])
      : new Uint8Array([113, 118, 59, 240, 159, 129, 104, 196]);
  const payload =
    version === "v0"
      ? getOfferEventV0Encoder().encode(common)
      : getOfferEventV1Encoder().encode({
          ...common,
          counteredOffer: CREATOR,
        });

  return new Uint8Array([...discriminator, ...payload]);
}

for (const version of ["v0", "v1"] as const) {
  test(`normalizes ${version === "v0" ? "OfferCreated" : "OfferCreatedV1"}`, () => {
    const event = decodeOfferbookEvent(eventData(version));
    expect(event).toBeDefined();

    expect(
      normalizeOfferCreatedEvent({
        event: event!,
        offerAddress: "fixture-offer-account-address",
        signature: "fixture-signature",
        slot: 123,
      }),
    ).toEqual({
      offerAddress: "fixture-offer-account-address",
      mint: SOL_MINT,
      apy: 700,
      signature: "fixture-signature",
      slot: 123,
      listedAt: "2025-07-25T00:00:00.000Z",
    });
  });
}

test("ignores unrelated event data", () => {
  expect(decodeOfferbookEvent(new Uint8Array(16))).toBeUndefined();
});
