import { serializeError, type Logger } from "@jupiter-offerbot/logger";
import {
  ClientDuplexStream,
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

function getTransactionOfferAddresses(
  update: SubscribeUpdate,
): Map<number, { offerAddress: string; type: OfferCreated["type"] }> {
  const transaction = update.transaction?.transaction?.transaction;
  const message = transaction?.message;
  if (!message) return new Map();

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

  if (!signature || !Number.isSafeInteger(slot) || slot < 0) return [];

  const accountKeys = [
    ...(transaction?.transaction?.message?.accountKeys ?? []),
    ...(transaction?.meta?.loadedWritableAddresses ?? []),
    ...(transaction?.meta?.loadedReadonlyAddresses ?? []),
  ].map((key) => bs58.encode(key));

  return (transaction?.meta?.innerInstructions ?? []).flatMap((innerInstructions) => {
    const offer = offerAddresses.get(innerInstructions.index);
    if (!offer) return [];

    return innerInstructions.instructions.flatMap((instruction) => {
      if (accountKeys[instruction.programIdIndex] !== OFFERBOOK_PROGRAM_ADDRESS.toBase58()) {
        return [];
      }

      try {
        const event = decodeOfferCreatedEvent(instruction.data);
        if (!event) return [];

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

export function createOfferbookSubscription(): SubscribeRequest {
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
    commitment: CommitmentLevel.PROCESSED,
    accountsDataSlice: [],
  };
}

async function handleUpdate(
  update: SubscribeUpdate,
  onOffer: (offer: OfferCreated) => Promise<void>,
): Promise<void> {
  for (const offer of extractOfferCreatedEvents(update)) {
    await onOffer(offer);
  }
}

export function destroyStreamOnAbort(signal: AbortSignal, stream: ClientDuplexStream): () => void {
  const abortStream = () => stream.destroy();
  if (signal.aborted) {
    abortStream();
    return () => {};
  }

  signal.addEventListener("abort", abortStream, { once: true });
  return () => signal.removeEventListener("abort", abortStream);
}

export async function streamOfferbookEvents(
  onOffer: (offer: OfferCreated) => Promise<void>,
  signal: AbortSignal,
  logger: Logger,
): Promise<void> {
  logger.info("Connecting to Yellowstone gRPC");
  await grpcClient.connect();
  // terminate if the stream is aborted before connection is established
  if (signal.aborted) return;
  logger.info("Connected to Yellowstone gRPC");

  const stream = await grpcClient.subscribe(createOfferbookSubscription());
  const streamClosed = new Promise<void>((resolve, reject) => {
    stream.on("error", (error) => {
      logger.error("Error in Offerbook stream", serializeError(error));
      reject(error);
      stream.end();
    });
    stream.on("end", () => {
      logger.info("Offerbook stream ended");
      resolve();
    });
    stream.on("close", () => {
      logger.info("Offerbook stream closed");
      resolve();
    });
  });
  const removeAbortListener = destroyStreamOnAbort(signal, stream);

  stream.on("data", (update: SubscribeUpdate) => {
    stream.pause();
    void handleUpdate(update, onOffer)
      .catch((error) => {
        logger.error("Failed to process Offerbook stream update", serializeError(error));
      })
      .finally(() => stream.resume());
  });

  logger.info("Opened Offerbook stream");
  try {
    await streamClosed;
  } finally {
    removeAbortListener();
    stream.destroy();
  }
}
