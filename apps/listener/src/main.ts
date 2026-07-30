import { submitOffer } from "./api";
import { streamOfferbookEvents } from "./event-stream";

async function main() {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  await streamOfferbookEvents(submitOffer, controller.signal);
}

await main();
