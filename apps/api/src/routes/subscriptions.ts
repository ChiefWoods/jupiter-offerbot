import { CreateSubscriptionSchema, PlatformSchema, UpdateSubscriptionSchema } from "../schema";
import { ApiError } from "../error";
import type { SubscriptionRepository } from "@jupiter-offerbot/prisma";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";
import { bearerAuthErrorResponses } from "../auth";

const ListQuerySchema = z.object({ platform: PlatformSchema, userId: z.string().min(1).max(128) });
const idSchema = z.string().uuid();
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

    .get("/", async (c) => {
      const platform = c.var.platform;
      const parsed = ListQuerySchema.safeParse(c.req.query());
      if (!parsed.success) throw new ApiError("INVALID_REQUEST");
      if (parsed.data.platform !== platform) throw new ApiError("PLATFORM_MISMATCH");
      return c.json({ subscriptions: await repository.list(platform, parsed.data.userId) });
    })

    .post("/", async (c) => {
      const platform = c.var.platform;
      const parsed = CreateSubscriptionSchema.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw new ApiError("INVALID_REQUEST");
      if (parsed.data.platform !== platform) throw new ApiError("PLATFORM_MISMATCH");
      try {
        return c.json({ subscription: await repository.create(parsed.data) }, 201);
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
    })

    .patch("/:id", async (c) => {
      const platform = c.var.platform;
      if (!idSchema.safeParse(c.req.param("id")).success)
        throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      const parsed = UpdateSubscriptionSchema.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw new ApiError("INVALID_REQUEST");
      const subscription = await repository.update(c.req.param("id"), platform, parsed.data);
      if (!subscription) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      return c.json({ subscription });
    })

    .delete("/:id", async (c) => {
      const platform = c.var.platform;
      if (!idSchema.safeParse(c.req.param("id")).success)
        throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      const deleted = await repository.delete(c.req.param("id"), platform);
      if (!deleted) throw new ApiError("SUBSCRIPTION_NOT_FOUND");
      return c.body(null, 204);
    });
}
