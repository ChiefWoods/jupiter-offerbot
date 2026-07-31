import { expect, test } from "bun:test";
import { signWebhook } from "@jupiter-offerbot/common";

test("signWebhook produces the documented SHA-256 HMAC format", async () => {
  await expect(signWebhook("secret", "1700000000", "payload")).resolves.toBe(
    "sha256=5af4877ab3c93d3201223b2c43d689a4c1e849ddd9091e066f03be6168ae79e9",
  );
});
