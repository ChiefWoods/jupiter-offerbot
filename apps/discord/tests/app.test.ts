import { expect, test } from "bun:test";
import type { Client } from "discord.js";

process.env.API_BASE_URL ??= "http://localhost:3000";
process.env.DISCORD_BRIDGE_TOKEN ??= "discord-bridge-token";
process.env.DISCORD_WEBHOOK_SECRET ??= "discord-webhook-secret";
process.env.DISCORD_BOT_TOKEN ??= "discord-bot-token";

const { createApp } = await import("../src/main");

test("the Discord bridge exposes a health endpoint", async () => {
  const app = createApp({} as Client, "secret", ["*"]);

  const response = await app.request("/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("the Discord bridge uses its configured CORS origin", async () => {
  const app = createApp({} as Client, "secret", ["https://bot.example"]);

  const response = await app.request("/health", { headers: { origin: "https://bot.example" } });

  expect(response.headers.get("access-control-allow-origin")).toBe("https://bot.example");
});

test("the Discord bridge returns a standard not-found response", async () => {
  const app = createApp({} as Client, "secret", ["*"]);

  const response = await app.request("/missing");

  expect(response.status).toBe(404);
  expect(response.headers.get("x-request-id")).toBeTruthy();
  expect(await response.json()).toEqual({
    error: { code: "NOT_FOUND", message: "Route not found." },
  });
});
