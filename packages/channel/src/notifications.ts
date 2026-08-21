import { signWebhook } from "@jupiter-offerbot/common";
import { z } from "zod";
import { formatApy } from "./apy";
import { env } from "./env";
import { formatSubscriptionAsset } from "./utils";

const OFFERBOOK_BASE_URL_BORROW = new URL("https://offerbook.jup.ag/tokens/borrow");
const OFFERBOOK_BASE_URL_LEND = new URL("https://offerbook.jup.ag/tokens/lend");

if (env.REFERRAL_UUID) {
  OFFERBOOK_BASE_URL_BORROW.searchParams.set("ref", env.REFERRAL_UUID);
  OFFERBOOK_BASE_URL_LEND.searchParams.set("ref", env.REFERRAL_UUID);
}

export const NotificationSchema = z.object({
  notificationId: z.uuid(),
  subscriptionId: z.uuid(),
  userId: z.string().min(1),
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  symbol: z.string().nullable(),
  type: z.enum(["borrow", "lend"]),
  apy: z.number().int(),
  signature: z.string().min(1),
  listedAt: z.iso.datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index++)
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return different === 0;
}

export function renderNotification(notification: Notification): {
  message: string;
  offerUrl: string;
} {
  const offerUrl = new URL(
    notification.type === "borrow" ? OFFERBOOK_BASE_URL_BORROW : OFFERBOOK_BASE_URL_LEND,
  );
  offerUrl.searchParams.set("offerId", notification.offerAddress);
  return {
    message: [
      `New ${notification.type} offer`,
      "",
      formatSubscriptionAsset(notification.mint, notification.symbol),
      `APY: ${formatApy(notification.apy)}`,
    ].join("\n"),
    offerUrl: offerUrl.toString(),
  };
}

export async function parseNotificationRequest(
  request: Request,
  secret: string,
  now: () => number = Date.now,
): Promise<{ notification: Notification } | { response: Response }> {
  const timestamp = request.headers.get("x-offerbot-timestamp");
  const signature = request.headers.get("x-offerbot-signature");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp))
    return { response: new Response("Unauthorized", { status: 401 }) };

  const timestampMs = Number(timestamp) * 1_000;
  if (!Number.isSafeInteger(timestampMs) || Math.abs(now() - timestampMs) > 300_000)
    return { response: new Response("Unauthorized", { status: 401 }) };

  const body = await request.text();
  if (!constantTimeEqual(signature, await signWebhook(secret, timestamp, body)))
    return { response: new Response("Unauthorized", { status: 401 }) };

  const payload = await Promise.resolve()
    .then(() => JSON.parse(body))
    .catch(() => undefined);
  const parsed = NotificationSchema.safeParse(payload);
  if (!parsed.success) return { response: new Response("Invalid notification", { status: 400 }) };
  return { notification: parsed.data };
}
