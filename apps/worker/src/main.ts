import { createNotificationJobRepository, createPrismaClient } from "@jupiter-offerbot/prisma";
import { createLogger, serializeError } from "@jupiter-offerbot/logger";
import { env } from "./env";
import { createOutboxWorker } from "./outbox";

const logger = createLogger("worker");
const prisma = createPrismaClient({ databaseUrl: env.DATABASE_URL });
const worker = createOutboxWorker(createNotificationJobRepository(prisma), {
  endpoints: {
    discord: { url: env.DISCORD_WEBHOOK_URL, secret: env.DISCORD_WEBHOOK_SECRET },
    telegram: { url: env.TELEGRAM_WEBHOOK_URL, secret: env.TELEGRAM_WEBHOOK_SECRET },
  },
});
let pollInFlight: Promise<void> | undefined;
let shuttingDown = false;

function poll() {
  if (pollInFlight || shuttingDown) {
    return;
  }

  pollInFlight = worker
    .processPendingJobs()
    .then((processedJobs) => {
      if (processedJobs > 0) {
        logger.info("Outbox poll completed", { processedJobs });
      }
    })
    .catch((error) => {
      logger.error("Outbox poll failed", serializeError(error));
    })
    .finally(() => {
      pollInFlight = undefined;
    });
}

logger.info("Worker starting", { pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS });
const timer = setInterval(poll, env.OUTBOX_POLL_INTERVAL_MS);
poll();

async function shutdown(signal: "SIGINT" | "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Worker shutdown requested", { signal });
  clearInterval(timer);
  await pollInFlight;
  await prisma.$disconnect();
  logger.info("Worker stopped");
}

function handleShutdown(signal: "SIGINT" | "SIGTERM") {
  void shutdown(signal).catch((error) => {
    logger.fatal("Worker shutdown failed", serializeError(error));
    process.exitCode = 1;
  });
}

process.once("SIGINT", () => handleShutdown("SIGINT"));
process.once("SIGTERM", () => handleShutdown("SIGTERM"));
