import { createLogger, serializeError } from "@jupiter-offerbot/logger";
import type { NotificationJobRepository } from "@jupiter-offerbot/prisma";
import { signWebhook } from "./signatures";

type OutboxOptions = {
  endpoints: Record<"discord" | "telegram", { url: string; secret: string }>;
};
const backoff = [10_000, 60_000, 300_000, 1_800_000, 7_200_000];
const logger = createLogger("worker");

export function createOutboxWorker(
  notificationJobs: NotificationJobRepository,
  options: OutboxOptions,
) {
  return {
    async runOnce() {
      const jobs = await notificationJobs.claimPending();
      for (const job of jobs) {
        const endpoint = options.endpoints[job.subscription.platform];
        const envelope = {
          notificationId: job.id,
          subscriptionId: job.subscriptionId,
          userId: job.subscription.userId,
          offerAddress: job.offerAddress,
          mint: job.mint,
          apy: job.apy,
          signature: job.signature,
          listedAt: job.listedAt.toISOString(),
        };
        const body = JSON.stringify(envelope);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        try {
          const response = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-offerbot-timestamp": timestamp,
              "x-offerbot-signature": await signWebhook(endpoint.secret, timestamp, body),
              "x-offerbot-delivery-id": job.id,
            },
            body,
          });
          if (response.ok) {
            await notificationJobs.markDelivered(job.id);
            continue;
          }
          throw new Error(`webhook returned HTTP ${response.status}`);
        } catch (cause) {
          const attempts = job.attempts + 1;
          const retryInMs = attempts < 5 ? backoff[attempts - 1] : undefined;
          await notificationJobs.markFailed(job.id, {
            attempts,
            lastError: String(cause),
            ...(retryInMs !== undefined && {
              availableAt: new Date(Date.now() + retryInMs),
            }),
          });
          logger.error("Webhook delivery failed", {
            notificationId: job.id,
            subscriptionId: job.subscriptionId,
            platform: job.subscription.platform,
            attempts,
            retryInMs,
            ...serializeError(cause),
          });
        }
      }
      return jobs.length;
    },
  };
}
