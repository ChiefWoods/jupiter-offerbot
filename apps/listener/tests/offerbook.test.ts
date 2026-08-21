import { expect, test } from "bun:test";
import {
  CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  getOfferEventV2Encoder,
  OfferSide,
  OfferStatus,
} from "jupiter-sdk/offerbook/web3js";
import { Address } from "@solana/web3.js";

import { decodeOfferCreatedEvent, normalizeOfferCreatedEvent } from "../src/offerbook";
import { createPingRequest } from "../src/event-stream";
import {
  CREATE_TOKEN_PRINCIPAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  isOfferCreationInstruction,
} from "../src/offerbook";

process.env.GRPC_ENDPOINT ??= "http://localhost:10000";
process.env.SOLANA_RPC_URL ??= "http://localhost:8899";
process.env.API_BASE_URL ??= "http://localhost:3000";
process.env.LISTENER_API_TOKEN ??= "listener-token";

const SOL_MINT = new Address("So11111111111111111111111111111111111111112");
const TOKEN_PROGRAM = new Address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const CREATOR = new Address("11111111111111111111111111111111");
const EVENT_CPI_DISCRIMINATOR = new Uint8Array([228, 69, 165, 46, 81, 203, 154, 29]);
const OFFER_CREATED_V2_DISCRIMINATOR = new Uint8Array([107, 228, 58, 148, 11, 235, 232, 181]);

test("creates the documented Yellowstone ping request", () => {
  expect(createPingRequest(42)).toEqual({
    ping: { id: 42 },
    accounts: {},
    accountsDataSlice: [],
    transactions: {},
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    slots: {},
  });
});

test("ignores unrelated event data", () => {
  expect(decodeOfferCreatedEvent(new Uint8Array(16))).toBeUndefined();
});

test("decodes the wire-compatible OfferCreatedV2 event", () => {
  const payload = getOfferEventV2Encoder().encode({
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
    counteredOffer: CREATOR,
    allowExtend: 1,
  });
  const event = decodeOfferCreatedEvent(
    new Uint8Array([...EVENT_CPI_DISCRIMINATOR, ...OFFER_CREATED_V2_DISCRIMINATOR, ...payload]),
  );

  expect(event).toHaveProperty("allowExtend", 1);
  expect(
    normalizeOfferCreatedEvent({
      event: event!,
      offerAddress: "fixture-offer-account-address",
      signature: "fixture-signature",
      slot: 123,
    }),
  ).toEqual({
    offerAddress: "fixture-offer-account-address",
    mint: SOL_MINT.toBase58(),
    apy: 700,
    signature: "fixture-signature",
    slot: 123,
    listedAt: "2025-07-25T00:00:00.000Z",
  });
});

test("only recognizes CreateTokenPrincipalOffer instructions", () => {
  expect(
    isOfferCreationInstruction(
      new Uint8Array(CREATE_TOKEN_PRINCIPAL_OFFER_INSTRUCTION_DISCRIMINATOR),
    ),
  ).toBe(true);
  expect(
    isOfferCreationInstruction(
      new Uint8Array(CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR),
    ),
  ).toBe(false);
});
