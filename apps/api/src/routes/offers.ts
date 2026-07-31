import { OfferCreatedSchema } from "../schema";
import { ApiError } from "../error";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { bearerAuthErrorResponses } from "../auth";
import type { OfferRepository } from "@jupiter-offerbot/prisma";
import { zValidator } from "@hono/zod-validator";

export function createOffersRouter(repository: OfferRepository, listenerToken: string) {
  return new Hono()
    .use(
      bearerAuth({
        token: listenerToken,
        ...bearerAuthErrorResponses,
      }),
    )
    .post(
      "/",
      zValidator("json", OfferCreatedSchema, (result) => {
        if (!result.success) throw new ApiError("INVALID_REQUEST");
      }),
      async (c) => c.json(await repository.ingest(c.req.valid("json")), 202),
    );
}
