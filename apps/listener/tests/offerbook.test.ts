import { expect, test } from "bun:test";
import {
  CREATE_TOKEN_COLLATERAL_OFFER_INSTRUCTION_DISCRIMINATOR,
  getOfferEventV1Encoder,
  getOfferEventV2Encoder,
  OfferSide,
  OfferStatus,
  type OfferEventV0Args,
} from "jupiter-sdk/offerbook/web3js";
import type { SubscribeUpdate } from "@triton-one/yellowstone-grpc";
import { Address } from "@solana/web3.js";
import bs58 from "bs58";

import { decodeOfferCreatedEvent, normalizeOfferCreatedEvent } from "../src/offerbook";
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
const OFFER = new Address("BWMbSZjY4yaaCmMQFerGLKTnZzwRrhxpQp49A1wGge1S");
const SIGNATURE =
  "524g5eVZxKgnLx3kY457o8ysV4xdBKxwnxiHWGEeQqVtwhrHiFZNLRScg9KcJR2NPartWnBHisZeVEM3tGdzmLd7";
const EVENT_CPI_DISCRIMINATOR = new Uint8Array([228, 69, 165, 46, 81, 203, 154, 29]);
const OFFER_CREATED_V2_DISCRIMINATOR = new Uint8Array([107, 228, 58, 148, 11, 235, 232, 181]);
const B5OJR_EVENT_DATA =
  "A2sWoaUuLzGmQwK1xrmqAzky85kA8dbJpLythKAj8SsqyYde6tGBmHPMhyyYRzri3DDJdSC81BHVFP3vyJzETdHxyotqRH5aKPKbPY1JKgugWau9gsmciWD1KAvvRjib4vvnMEPRf1EE9bhEKrwhcFpfRyyvzV2XXRTAngGtXdCEBvumgorcuppFwFaR8RpD4Ne6XzNifZbM4QTKXGDfxzNxyWxkGRupcZqYhfrPBBYvZLPUNR8U5VAkbwYPYq2cGimFbmPhg3BGDTMxGstqGARHj5X21UpKnL3XhRVUFSj5PV3UmfNwwxpV8zkT9LoMowsUmNyrR1QV6XwaJMwppjeGbqsAdDH4Mx9YNYd5bkuW1rcwavxWanF1y5YDGMfZ5ZVzXZAXGy6EPqzcP7uTDWQ6ZFoCQmaqWhc23WB1ggoQxUX6vykREGjoSSA838m";

function eventData(
  discriminator = new Uint8Array([113, 118, 59, 240, 159, 129, 104, 196]),
): Uint8Array {
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
  const payload = getOfferEventV1Encoder().encode({
    ...common,
    counteredOffer: CREATOR,
  });

  return new Uint8Array([...discriminator, ...payload]);
}

function eventCpiData(): Uint8Array {
  return new Uint8Array([...EVENT_CPI_DISCRIMINATOR, ...eventData()]);
}

test("normalizes OfferCreatedV1", () => {
  const event = decodeOfferCreatedEvent(eventCpiData());
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
    mint: SOL_MINT.toBase58(),
    apy: 700,
    signature: "fixture-signature",
    slot: 123,
    listedAt: "2025-07-25T00:00:00.000Z",
  });
});

test("ignores unrelated event data", () => {
  expect(decodeOfferCreatedEvent(new Uint8Array(16))).toBeUndefined();
});

test("does not require a specific CPI wrapper discriminator", () => {
  expect(
    decodeOfferCreatedEvent(new Uint8Array([...new Uint8Array(8), ...eventData()])),
  ).toBeDefined();
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
});

test("decodes the CPI event emitted for B5oJrPWm5thDRhDSEVr4WP4pzR7uZ3qNHHAp77Jmuof", () => {
  expect(decodeOfferCreatedEvent(new Uint8Array(bs58.decode(B5OJR_EVENT_DATA)))).toBeDefined();
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

test("extracts an OfferCreatedV1 event emitted through an Offerbook inner instruction", async () => {
  const { extractOfferCreatedEvents } = await import("../src/event-stream");
  const update: SubscribeUpdate = {
    filters: [],
    createdAt: undefined,
    transaction: {
      slot: "437033878",
      transaction: {
        signature: new Uint8Array(bs58.decode(SIGNATURE)),
        isVote: false,
        index: "0",
        transaction: {
          signatures: [new Uint8Array(bs58.decode(SIGNATURE))],
          message: {
            header: undefined,
            accountKeys: [
              CREATOR,
              CREATOR,
              CREATOR,
              OFFER,
              "offerbkFMvVfpQhL8ZQ5iromnjct5rz3r52B9ewu3ie",
            ].map((key) => new Uint8Array(bs58.decode(key.toString()))),
            recentBlockhash: new Uint8Array(),
            versioned: false,
            addressTableLookups: [],
            instructions: [
              {
                programIdIndex: 4,
                accounts: new Uint8Array([0, 1, 2, 3]),
                data: new Uint8Array([78, 9, 69, 142, 189, 64, 171, 13]),
              },
            ],
          },
        },
        meta: {
          err: undefined,
          fee: "0",
          preBalances: [],
          postBalances: [],
          innerInstructionsNone: false,
          innerInstructions: [
            {
              index: 0,
              instructions: [
                {
                  programIdIndex: 4,
                  accounts: new Uint8Array(),
                  data: eventCpiData(),
                },
              ],
            },
          ],
          logMessages: [],
          logMessagesNone: false,
          preTokenBalances: [],
          postTokenBalances: [],
          rewards: [],
          loadedWritableAddresses: [],
          loadedReadonlyAddresses: [],
          returnData: undefined,
          returnDataNone: true,
        },
      },
    },
  };

  expect(extractOfferCreatedEvents(update)).toEqual([
    {
      offerAddress: OFFER.toBase58(),
      mint: SOL_MINT.toBase58(),
      apy: 700,
      signature: SIGNATURE,
      slot: 437033878,
      listedAt: "2025-07-25T00:00:00.000Z",
    },
  ]);
});
