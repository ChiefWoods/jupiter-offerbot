import { createRedisClient } from "@jupiter-offerbot/redis";
import { getConnInfo } from "hono/bun";
import type { Context, MiddlewareHandler } from "hono";
import { isIP } from "node:net";

export type RateLimitResult = {
  count: number;
  retryAfterSeconds: number;
};

export type RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<RateLimitResult>;
};

export type RateLimitOptions = {
  maxRequests: number;
  windowSeconds: number;
  trustedHeaderName?: string;
};

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}
`;

export function getClientIp(c: Context, trustedHeaderName: string | undefined): string {
  let value: string | undefined;

  if (trustedHeaderName) {
    value = c.req.header(trustedHeaderName);
  } else {
    try {
      value = getConnInfo(c).remote.address;
    } catch {
      return "unknown";
    }
  }
  const ip = value?.trim();

  return ip && !ip.includes(",") && isIP(ip) ? ip : "unknown";
}

export function createRedisRateLimitStore(redisUrl: string): RateLimitStore {
  const client = createRedisClient({ url: redisUrl });
  let connecting: Promise<void> | undefined;

  client.on("error", (error) => console.error("Redis client error", error));

  async function connect() {
    if (client.isOpen) return;

    connecting ??= client
      .connect()
      .then(() => undefined)
      .finally(() => {
        connecting = undefined;
      });
    await connecting;
  }

  return {
    async increment(key, windowSeconds) {
      await connect();

      const result = (await client.eval(incrementScript, {
        keys: [key],
        arguments: [String(windowSeconds)],
      })) as [number, number];
      const [count, ttl] = result;

      if (!Number.isInteger(count) || !Number.isInteger(ttl) || ttl < 0) {
        throw new Error("Redis returned an invalid rate-limit result.");
      }

      return { count, retryAfterSeconds: ttl };
    },
  };
}

export function createRateLimitMiddleware(
  store: RateLimitStore,
  options: RateLimitOptions,
): MiddlewareHandler {
  return async (c, next) => {
    try {
      const result = await store.increment(
        `jupiter-offerbot:rate-limit:v1:${getClientIp(c, options.trustedHeaderName)}`,
        options.windowSeconds,
      );
      const remaining = Math.max(0, options.maxRequests - result.count);

      c.header("RateLimit-Limit", String(options.maxRequests));
      c.header("RateLimit-Remaining", String(remaining));
      c.header("RateLimit-Reset", String(result.retryAfterSeconds));

      if (result.count > options.maxRequests) {
        c.header("Retry-After", String(result.retryAfterSeconds));
        return c.json(
          {
            error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later." },
            meta: { requestId: c.get("requestId") },
          },
          429,
        );
      }
    } catch {
      return c.json(
        {
          error: { code: "RATE_LIMIT_UNAVAILABLE", message: "Rate limiting is unavailable." },
          meta: { requestId: c.get("requestId") },
        },
        503,
      );
    }

    await next();
  };
}
