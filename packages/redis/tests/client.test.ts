import { describe, expect, test } from "bun:test";

import { createRedisClient } from "../src/client";

describe("createRedisClient", () => {
  test("creates an unopened client for the supplied Redis URL", () => {
    const client = createRedisClient({ url: "redis://localhost:6379/2" });

    expect(client.isOpen).toBe(false);
  });
});
