import { parseNotificationRequest, renderNotification } from "@jupiter-offerbot/channel";
import type { Api } from "grammy";

export function createWebhookHandler(messenger: Api, secret: string, now: () => number = Date.now) {
  return async (request: Request): Promise<Response> => {
    const parsed = await parseNotificationRequest(request, secret, now);
    if ("response" in parsed) return parsed.response;

    try {
      await messenger.sendMessage(
        parsed.notification.userId,
        renderNotification(parsed.notification),
      );
      return new Response(null, { status: 204 });
    } catch {
      return new Response("Telegram delivery failed", { status: 502 });
    }
  };
}
