import { getBase58Decoder } from "@solana/kit";
import { serializeError, type Logger } from "@jupiter-offerbot/logger";
import {
  CommitmentLevel,
  type SubscribeRequest,
  type SubscribeUpdate,
} from "@triton-one/yellowstone-grpc";

import {
  decodeOfferbookEvent,
  isOfferCreationInstruction,
  normalizeOfferCreatedEvent,
  OFFERBOOK_PROGRAM_ADDRESS,
  type OfferCreated,
} from "./offerbook";
import { grpcClient } from "./solana";

const base58Decoder = getBase58Decoder();
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

function getTransactionOfferAddresses(update: SubscribeUpdate): string[] {
  const transaction = update.transaction?.transaction?.transaction;
  const message = transaction?.message;
  if (!message) {
    return [];
  }

  const accountKeys = [
    ...message.accountKeys,
    ...(update.transaction?.transaction?.meta?.loadedWritableAddresses ?? []),
    ...(update.transaction?.transaction?.meta?.loadedReadonlyAddresses ?? []),
  ].map((key) => base58Decoder.decode(key));

  return message.instructions.flatMap((instruction) => {
    const programAddress = accountKeys[instruction.programIdIndex];
    const offerAccountIndex = instruction.accounts[3];
    const offerAddress =
      offerAccountIndex === undefined ? undefined : accountKeys[offerAccountIndex];

    return programAddress === OFFERBOOK_PROGRAM_ADDRESS &&
      offerAddress !== undefined &&
      isOfferCreationInstruction(instruction.data)
      ? [offerAddress]
      : [];
  });
}

/** Extracts supported event logs and pairs them with their created offer PDA. */
function extractOfferCreatedEvents(update: SubscribeUpdate): OfferCreated[] {
  const transaction = update.transaction?.transaction;
  const logs = transaction?.meta?.logMessages ?? [];
  const offerAddresses = getTransactionOfferAddresses(update);
  const signature = transaction ? base58Decoder.decode(transaction.signature) : undefined;
  const slot = Number(update.transaction?.slot);

  if (!signature || !Number.isSafeInteger(slot) || slot < 0) {
    return [];
  }

  const events = logs.flatMap((log) => {
    const match = /^Program data: (.+)$/.exec(log);
    if (!match?.[1]) {
      return [];
    }

    try {
      const event = decodeOfferbookEvent(new Uint8Array(Buffer.from(match[1], "base64")));
      return event ? [event] : [];
    } catch {
      return [];
    }
  });

  return events.flatMap((event, index) => {
    const offerAddress = offerAddresses[index];
    if (!offerAddress) {
      return [];
    }

    const normalized = normalizeOfferCreatedEvent({
      event,
      offerAddress,
      signature,
      slot,
    });
    return normalized ? [normalized] : [];
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
        accountInclude: [OFFERBOOK_PROGRAM_ADDRESS],
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
