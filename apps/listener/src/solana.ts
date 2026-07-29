import { createSolanaRpc } from "@solana/kit";
import Client from "@triton-one/yellowstone-grpc";

import { env } from "./env";

export const solanaRpc = createSolanaRpc(env.SOLANA_RPC_URL);

export const grpcClient = new Client(
  env.GRPC_ENDPOINT,
  env.GRPC_TOKEN,
  {
    grpcMaxDecodingMessageSize: 64 * 1024 * 1024,
  },
  {
    backoff: {
      initialIntervalMs: 100,
      multiplier: 2,
      maxRetries: 10,
    },
    slotRetention: 250,
  },
);
