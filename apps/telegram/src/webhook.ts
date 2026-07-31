import { signWebhook } from "@jupiter-offerbot/common";
import type { Api } from "grammy";
import { z } from "zod";
import { formatApy } from "./apy";
import { constantTimeEqual } from "./utils";

const NotificationSchema = z.object({
  notificationId: z.uuid(),
  subscriptionId: z.uuid(),
  userId: z.string().min(1),
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  apy: z.number().int(),
  signature: z.string().min(1),
  listedAt: z.iso.datetime(),
});

function renderNotification(notification: z.infer<typeof NotificationSchema>): string {
  return [
    "Matched Offerbook offer",
    `Mint: ${notification.mint}`,
    `Offer: ${notification.offerAddress}`,
    `APY: ${formatApy(notification.apy)}`,
    `Transaction: ${notification.signature}`,
  ].join("\n");
}

export function createWebhookHandler(messenger: Api, secret: string, now: () => number = Date.now) {
  return async (request: Request): Promise<Response> => {
    const timestamp = request.headers.get("x-offerbot-timestamp");
    const signature = request.headers.get("x-offerbot-signature");

    if (!timestamp || !signature || !/^\d+$/.test(timestamp))
      return new Response("Unauthorized", { status: 401 });
    const timestampMs = Number(timestamp) * 1_000;

    if (!Number.isSafeInteger(timestampMs) || Math.abs(now() - timestampMs) > 300_000)
      return new Response("Unauthorized", { status: 401 });

    const body = await request.text();

    if (!constantTimeEqual(signature, await signWebhook(secret, timestamp, body)))
      return new Response("Unauthorized", { status: 401 });

    const payload = await Promise.resolve()
      .then(() => JSON.parse(body))
      .catch(() => undefined);
    const parsed = NotificationSchema.safeParse(payload);

    if (!parsed.success) return new Response("Invalid notification", { status: 400 });

    try {
      await messenger.sendMessage(parsed.data.userId, renderNotification(parsed.data));
      return new Response(null, { status: 204 });
    } catch {
      return new Response("Telegram delivery failed", { status: 502 });
    }
  };
}
