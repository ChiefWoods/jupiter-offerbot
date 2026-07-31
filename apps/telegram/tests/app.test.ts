import { expect, test } from "bun:test";
import type { Api } from "grammy";
import { createApp } from "../src/main";

test("the Telegram bridge exposes a health endpoint", async () => {
  const app = createApp({} as Api, "secret", ["*"]);

  const response = await app.request("/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("the Telegram bridge uses its configured CORS origin", async () => {
  const app = createApp({} as Api, "secret", ["https://bot.example"]);

  const response = await app.request("/health", { headers: { origin: "https://bot.example" } });

  expect(response.headers.get("access-control-allow-origin")).toBe("https://bot.example");
});

test("the Telegram bridge returns a standard not-found response", async () => {
  const app = createApp({} as Api, "secret", ["*"]);

  const response = await app.request("/missing");

  expect(response.status).toBe(404);
  expect(response.headers.get("x-request-id")).toBeTruthy();
  expect(await response.json()).toEqual({
    error: { code: "NOT_FOUND", message: "Route not found." },
  });
});
