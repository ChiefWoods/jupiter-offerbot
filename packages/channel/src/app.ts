import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

export function createChannelApp(
  notificationHandler: (request: Request) => Promise<Response>,
  corsAllowedOrigin: string[],
) {
  return new Hono()
    .use("*", cors({ origin: corsAllowedOrigin }))
    .use(logger())
    .use("*", requestId())
    .get("/health", (c) => c.json({ ok: true }))
    .post("/internal/notifications", (c) => notificationHandler(c.req.raw))
    .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404))
    .onError((_error, c) =>
      c.json(
        {
          error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
          meta: { requestId: c.get("requestId") },
        },
        500,
      ),
    );
}
