import Client from "@triton-one/yellowstone-grpc";
import { Connection } from "@solana/web3.js";

import { env } from "./env";

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

export const solanaConnection = new Connection(env.SOLANA_RPC_URL, "processed");
