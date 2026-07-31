import { signWebhook } from "@jupiter-offerbot/common";
import { z } from "zod";
import { formatApy } from "./apy";

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

type DiscordMessenger = {
  users: {
    fetch(userId: string): Promise<{ send(message: string): Promise<unknown> }>;
  };
};

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let different = 0;
  for (let index = 0; index < left.length; index++)
    different |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return different === 0;
}

function renderNotification(notification: z.infer<typeof NotificationSchema>): string {
  return [
    "Matched Offerbook offer",
    `Mint: ${notification.mint}`,
    `Offer: ${notification.offerAddress}`,
    `APY: ${formatApy(notification.apy)}`,
    `Transaction: ${notification.signature}`,
  ].join("\n");
}

function isUnavailableUser(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    [50007, 10007, 10013].includes((error as { code: number }).code)
  );
}

export function createWebhookHandler(
  messenger: DiscordMessenger,
  secret: string,
  now: () => number = Date.now,
) {
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
      const user = await messenger.users.fetch(parsed.data.userId);
      await user.send(renderNotification(parsed.data));
      return new Response(null, { status: 204 });
    } catch (error) {
      return new Response(
        isUnavailableUser(error) ? "Discord user unavailable" : "Discord delivery failed",
        {
          status: isUnavailableUser(error) ? 404 : 502,
        },
      );
    }
  };
}
