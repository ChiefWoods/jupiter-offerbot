import { OfferCreatedSchema } from "../schema";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bearerAuthErrorResponses } from "../auth";
import type { OfferRepository } from "@jupiter-offerbot/prisma";

export function createOffersRouter(repository: OfferRepository, listenerToken: string) {
  return new Hono()
    .use(
      bearerAuth({
        token: listenerToken,
        ...bearerAuthErrorResponses,
      }),
    )
    .post("/", async (c) => {
      const parsed = OfferCreatedSchema.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success)
        return c.json({ error: { code: "INVALID_REQUEST", message: "Invalid request." } }, 400);
      return c.json(await repository.ingest(parsed.data), 202);
    });
}
