import { createClient, type RedisClientType } from "redis";

import type { RedisConfig } from "./config";

export type RedisClient = RedisClientType;

export function createRedisClient(config: RedisConfig): RedisClient {
  return createClient({ url: config.url });
}
