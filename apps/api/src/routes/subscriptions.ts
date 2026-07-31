import { CreateSubscriptionSchema, PlatformSchema, UpdateSubscriptionSchema } from "../schema";
import { ApiError } from "../error";
import type { SubscriptionRepository } from "@jupiter-offerbot/prisma";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";
import { bearerAuthErrorResponses } from "../auth";

const ListQuerySchema = z.object({ platform: PlatformSchema, userId: z.string().min(1).max(128) });
const IdParamSchema = z.object({ id: z.uuid() });
type Platform = "discord" | "telegram";
type Env = { Variables: { platform: Platform } };

function platformForToken(token: string, tokens: Record<Platform, string>) {
  if (token === tokens.discord) return "discord" as const;
  if (token === tokens.telegram) return "telegram" as const;
  return null;
}

export function createSubscriptionsRouter(
  repository: SubscriptionRepository,
  tokens: Record<"discord" | "telegram", string>,
) {
  return new Hono<Env>()
    .use(
      bearerAuth<Env>({
        verifyToken: (token, c) => {
          const platform = platformForToken(token, tokens);
          if (!platform) return false;
          c.set("platform", platform);
          return true;
        },
        ...bearerAuthErrorResponses,
      }),
    )

    .get(
      "/",
      zValidator("query", ListQuerySchema, (result) => {
        if (!result.success) throw new ApiError("INVALID_REQUEST");
      }),
      async (c) => {
        const platform = c.var.platform;
        const query = c.req.valid("query");
        if (query.platform !== platform) throw new ApiError("PLATFORM_MISMATCH");
        return c.json({ subscriptions: await repository.list(platform, query.userId) });
      },
    )

    .post(
      "/",
      zValidator("json", CreateSubscriptionSchema, (result) => {
        if (!result.success) throw new ApiError("INVALID_REQUEST");
      }),
      async (c) => {
        const platform = c.var.platform;
        const input = c.req.valid("json");
        if (input.platform !== platform) throw new ApiError("PLATFORM_MISMATCH");
        try {
          return c.json({ subscription: await repository.create(input) }, 201);
        } catch (cause) {
          if (
            cause instanceof Error &&
            ["limit", "Subscription limit reached."].includes(cause.message)
          )
            throw new ApiError("SUBSCRIPTION_LIMIT_REACHED");
          if (
            cause instanceof Error &&
            ["unique", "Subscription already exists."].includes(cause.message)
          )
            throw new ApiError("SUBSCRIPTION_ALREADY_EXISTS");
          throw cause;
        }
      },
    )

    .patch(
      "/:id",
      zValidator("param", IdParamSchema, (result) => {
        if (!result.success) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      }),
      zValidator("json", UpdateSubscriptionSchema, (result) => {
        if (!result.success) throw new ApiError("INVALID_REQUEST");
      }),
      async (c) => {
        const platform = c.var.platform;
        const { id } = c.req.valid("param");
        const subscription = await repository.update(id, platform, c.req.valid("json"));
        if (!subscription) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
        return c.json({ subscription });
      },
    )

    .delete(
      "/:id",
      zValidator("param", IdParamSchema, (result) => {
        if (!result.success) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      }),
      async (c) => {
        const platform = c.var.platform;
        const { id } = c.req.valid("param");
        const deleted = await repository.delete(id, platform);
        if (!deleted) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
        return c.body(null, 204);
      },
    );
}
