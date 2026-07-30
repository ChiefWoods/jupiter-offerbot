import { expect, test } from "bun:test";
import { serializeError } from "../src";

test("serializeError preserves Error instances for Pino", () => {
  const error = new Error("offer ingestion failed");

  expect(serializeError(error)).toEqual({ err: error });
});

test("serializeError stringifies non-Error values", () => {
  expect(serializeError({ reason: "timeout" })).toEqual({
    error: "[object Object]",
  });
});
