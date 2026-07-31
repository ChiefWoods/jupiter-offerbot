import { parseNotificationRequest, renderNotification } from "@jupiter-offerbot/channel";

type DiscordMessenger = {
  users: {
    fetch(userId: string): Promise<{ send(message: string): Promise<unknown> }>;
  };
};

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
    const parsed = await parseNotificationRequest(request, secret, now);
    if ("response" in parsed) return parsed.response;

    try {
      const user = await messenger.users.fetch(parsed.notification.userId);
      await user.send(renderNotification(parsed.notification));
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
