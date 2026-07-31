import { parseNotificationRequest, renderNotification } from "@jupiter-offerbot/channel";
import type { Api } from "grammy";

export function createWebhookHandler(messenger: Api, secret: string, now: () => number = Date.now) {
  return async (request: Request): Promise<Response> => {
    const parsed = await parseNotificationRequest(request, secret, now);
    if ("response" in parsed) return parsed.response;

    try {
      const rendered = renderNotification(parsed.notification);
      await messenger.sendMessage(parsed.notification.userId, rendered.message, {
        reply_markup: { inline_keyboard: [[{ text: "View offer", url: rendered.offerUrl }]] },
      });
      return new Response(null, { status: 204 });
    } catch {
      return new Response("Telegram delivery failed", { status: 502 });
    }
  };
}
