import { serializeError, type Logger } from "@jupiter-offerbot/logger";
import {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeUpdate,
} from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";

import {
  decodeOfferCreatedEvent,
  getOfferCreationType,
  normalizeOfferCreatedEvent,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferCreated,
} from "./offerbook";
import { grpcClient } from "./solana";

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
const PING_INTERVAL_MILLISECONDS = 30_000;

export function createPingRequest(id: number): SubscribeRequest {
  return {
    ping: { id },
    accounts: {},
    accountsDataSlice: [],
    transactions: {},
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    slots: {},
  };
}

function getTransactionOfferAddresses(update: SubscribeUpdate): Map<
  number,
  {
    offerAddress: string;
    type: OfferCreated["type"];
  }
> {
  const transaction = update.transaction?.transaction?.transaction;
  const message = transaction?.message;
  if (!message) {
    return new Map();
  }

  const accountKeys = [
    ...message.accountKeys,
    ...(update.transaction?.transaction?.meta?.loadedWritableAddresses ?? []),
    ...(update.transaction?.transaction?.meta?.loadedReadonlyAddresses ?? []),
  ].map((key) => bs58.encode(key));

  return new Map(
    message.instructions.flatMap((instruction, index) => {
      const programAddress = accountKeys[instruction.programIdIndex];
      const offerAccountIndex = instruction.accounts[3];
      const offerAddress =
        offerAccountIndex === undefined ? undefined : accountKeys[offerAccountIndex];

      const type = getOfferCreationType(instruction.data);
      return programAddress === OFFERBOOK_PROGRAM_ADDRESS.toBase58() &&
        offerAddress !== undefined &&
        type !== undefined
        ? [[index, { offerAddress, type }] as const]
        : [];
    }),
  );
}

export function extractOfferCreatedEvents(update: SubscribeUpdate): OfferCreated[] {
  const transaction = update.transaction?.transaction;
  const offerAddresses = getTransactionOfferAddresses(update);
  const signature = transaction ? bs58.encode(transaction.signature) : undefined;
  const slot = Number(update.transaction?.slot);

  if (!signature || !Number.isSafeInteger(slot) || slot < 0) {
    return [];
  }

  const accountKeys = [
    ...(transaction?.transaction?.message?.accountKeys ?? []),
    ...(transaction?.meta?.loadedWritableAddresses ?? []),
    ...(transaction?.meta?.loadedReadonlyAddresses ?? []),
  ].map((key) => bs58.encode(key));

  return (transaction?.meta?.innerInstructions ?? []).flatMap((innerInstructions) => {
    const offer = offerAddresses.get(innerInstructions.index);
    if (!offer) {
      return [];
    }

    return innerInstructions.instructions.flatMap((instruction) => {
      if (accountKeys[instruction.programIdIndex] !== OFFERBOOK_PROGRAM_ADDRESS.toBase58()) {
        return [];
      }

      try {
        const event = decodeOfferCreatedEvent(instruction.data);
        if (!event) {
          return [];
        }

        const normalized = normalizeOfferCreatedEvent({
          event,
          offerAddress: offer.offerAddress,
          signature,
          slot,
          type: offer.type,
        });
        return normalized ? [normalized] : [];
      } catch {
        return [];
      }
    });
  });
}

function createOfferbookSubscription(fromSlot?: bigint): SubscribeRequest {
  return {
    accounts: {},
    slots: {},
    transactions: {
      offerbook: {
        vote: false,
        failed: false,
        accountInclude: [OFFERBOOK_PROGRAM_ADDRESS.toBase58()],
        accountExclude: [],
        accountRequired: [],
      },
    },
    transactionsStatus: {},
    blocks: {},
    blocksMeta: {},
    entry: {},
    commitment: CommitmentLevel.CONFIRMED,
    accountsDataSlice: [],
    ...(fromSlot === undefined ? {} : { fromSlot: fromSlot.toString() }),
  };
}

/**
 * Streams Offerbook transactions forever, replaying from the last submitted
 * slot after a disconnect. The API's job uniqueness makes replay safe.
 */
export async function streamOfferbookEvents(
  onOffer: (offer: OfferCreated) => Promise<void>,
  signal: AbortSignal,
  logger: Logger,
): Promise<void> {
  let lastSubmittedSlot: bigint | undefined;
  let reconnectAttempt = 0;

  logger.info("Connecting to Yellowstone gRPC");
  await grpcClient.connect();
  logger.info("Connected to Yellowstone gRPC");

  while (!signal.aborted) {
    try {
      logger.info(
        "Opening Offerbook stream",
        lastSubmittedSlot === undefined ? {} : { fromSlot: lastSubmittedSlot.toString() },
      );
      const stream = await grpcClient.subscribe(createOfferbookSubscription(lastSubmittedSlot));
      let pingId = 0;
      const pingInterval = setInterval(() => {
        stream.write(createPingRequest(++pingId));
      }, PING_INTERVAL_MILLISECONDS);
      const abortStream = () => stream.destroy();
      signal.addEventListener("abort", abortStream, { once: true });

      try {
        if (signal.aborted) {
          stream.destroy();
        }

        for await (const update of stream) {
          for (const offer of extractOfferCreatedEvents(update)) {
            await onOffer(offer);
            lastSubmittedSlot = BigInt(offer.slot);
          }
        }

        if (!signal.aborted) {
          logger.warn("Offerbook stream ended; reopening");
        }
      } finally {
        clearInterval(pingInterval);
        signal.removeEventListener("abort", abortStream);
        stream.destroy();

        if (signal.aborted) {
          logger.info("Offerbook stream closed");
        }
      }

      reconnectAttempt = 0;
    } catch (error) {
      if (signal.aborted) {
        break;
      }

      const delay =
        RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? 30_000;
      reconnectAttempt += 1;
      logger.error("Offerbook stream disconnected", {
        retryInMs: delay,
        ...serializeError(error),
      });
      await Bun.sleep(delay);
    }
  }
}
