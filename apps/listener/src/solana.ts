import Client from "@triton-one/yellowstone-grpc";

import { env } from "./env";

export const grpcClient = new Client(
  env.GRPC_ENDPOINT,
  env.GRPC_TOKEN,
  {
    grpcConnectTimeout: 10_000,
    grpcHttp2KeepAliveInterval: 20_000,
    grpcKeepAliveTimeout: 10_000,
    grpcKeepAliveWhileIdle: true,
    grpcTcpKeepalive: 30_000,
    grpcTcpNodelay: true,
    grpcHttp2AdaptiveWindow: true,
    grpcInitialConnectionWindowSize: 16 * 1024 * 1024,
    grpcInitialStreamWindowSize: 16 * 1024 * 1024,
    grpcMaxDecodingMessageSize: 64 * 1024 * 1024,
    grpcMaxEncodingMessageSize: 4 * 1024 * 1024,
    grpcBufferSize: 4_096,
  },
  {
    enabled: true,
    backoff: {
      initialIntervalMs: 1_000,
      multiplier: 2,
      maxRetries: 10,
    },
    slotRetention: 200,
  },
);
