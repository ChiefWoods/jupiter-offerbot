# `@jupiter-offerbot/redis`

Shared Redis client factory for Jupiter Offerbot applications.

```ts
import { createRedisClient } from "@jupiter-offerbot/redis";

const redis = createRedisClient({ url: process.env.REDIS_URL! });
redis.on("error", console.error);

await redis.connect();
try {
  await redis.set("example", "value");
} finally {
  await redis.quit();
}
```

The caller owns the connection lifecycle: connect once during application startup and call `quit()` during graceful shutdown.
