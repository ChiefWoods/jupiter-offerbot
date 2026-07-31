import type { Mint, Platform, PrismaClient, Subscription } from "../../generated/prisma/client";
import type { JupiterClient } from "../../../../apps/api/src/jupiter";
import { isPrismaUniqueError, serializable } from "../utils";

export type SubscriptionInput = {
  platform: Platform;
  userId: string;
  mint: string;
  maxApy: number | null;
};

export type SubscriptionUpdate = Pick<SubscriptionInput, "maxApy">;

export type SubscriptionRecord = Subscription & { symbol: string | null };

export function createSubscriptionRepository(
  prisma: PrismaClient,
  maxSubscriptionsPerUser: number,
  jupiterClient: JupiterClient,
) {
  const withSymbol = (subscription: Subscription & { mintMetadata: Mint }): SubscriptionRecord => {
    const { mintMetadata, ...record } = subscription;
    return { ...record, symbol: mintMetadata.symbol };
  };

  return {
    async create(input: SubscriptionInput) {
      const existingMint = await prisma.mint.findUnique({ where: { mint: input.mint } });
      let symbol = existingMint?.symbol ?? null;
      if (!existingMint) {
        try {
          symbol = (await jupiterClient.findToken(input.mint)).symbol;
        } catch {
          throw new Error("Mint metadata unavailable.");
        }
      }
      try {
        return await serializable(prisma, async (tx) => {
          const count = await tx.subscription.count({
            where: { platform: input.platform, userId: input.userId },
          });
          if (count >= maxSubscriptionsPerUser) {
            throw new Error("Subscription limit reached.");
          }
          await tx.mint.upsert({
            where: { mint: input.mint },
            create: { mint: input.mint, symbol },
            update: {},
          });
          const subscription = await tx.subscription.create({
            data: input,
            include: { mintMetadata: true },
          });
          return withSymbol(subscription);
        });
      } catch (cause) {
        if (isPrismaUniqueError(cause)) {
          throw new Error("Subscription already exists.");
        }
        throw cause;
      }
    },
    async list(platform: Platform, userId: string) {
      const subscriptions = await prisma.subscription.findMany({
        where: { platform, userId },
        orderBy: { createdAt: "asc" },
        include: { mintMetadata: true },
      });
      return subscriptions.map(withSymbol);
    },
    async update(id: string, platform: Platform, input: SubscriptionUpdate) {
      const { count } = await prisma.subscription.updateMany({
        where: { id, platform },
        data: input,
      });
      if (!count) return null;
      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: { mintMetadata: true },
      });
      return subscription ? withSymbol(subscription) : null;
    },
    async delete(id: string, platform: Platform) {
      const { count } = await prisma.subscription.deleteMany({ where: { id, platform } });
      return count === 1;
    },
  };
}

export type SubscriptionRepository = ReturnType<typeof createSubscriptionRepository>;
