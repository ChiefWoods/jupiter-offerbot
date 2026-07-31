import { submitOffer } from "./api";
import { streamOfferbookEvents } from "./event-stream";
import { createLogger, serializeError } from "@jupiter-offerbot/logger";

const logger = createLogger("listener");

async function main() {
  logger.info("Listener starting");

  const controller = new AbortController();
  const shutdown = (signal: "SIGINT" | "SIGTERM") => {
    logger.info("Listener shutdown requested", { signal });
    controller.abort();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  await streamOfferbookEvents((offer) => submitOffer(offer, logger), controller.signal, logger);
  logger.info("Listener stopped");
}

try {
  await main();
} catch (error) {
  logger.fatal("Listener exited unexpectedly", serializeError(error));
  process.exitCode = 1;
}
