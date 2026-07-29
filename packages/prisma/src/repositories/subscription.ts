import type { Platform, PrismaClient, Subscription } from "../../generated/prisma/client";
import { isPrismaUniqueError, serializable } from "../utils";

export type SubscriptionInput = {
  platform: Platform;
  userId: string;
  mint: string;
  maxApy: number | null;
};

export type SubscriptionUpdate = Pick<SubscriptionInput, "maxApy">;

export type SubscriptionRecord = Subscription;

export function createSubscriptionRepository(
  prisma: PrismaClient,
  maxSubscriptionsPerUser: number,
) {
  return {
    async create(input: SubscriptionInput) {
      try {
        return await serializable(prisma, async (tx) => {
          const count = await tx.subscription.count({
            where: { platform: input.platform, userId: input.userId },
          });
          if (count >= maxSubscriptionsPerUser) {
            throw new Error("Subscription limit reached.");
          }
          return tx.subscription.create({ data: input });
        });
      } catch (cause) {
        if (isPrismaUniqueError(cause)) {
          throw new Error("Subscription already exists.");
        }
        throw cause;
      }
    },
    async list(platform: Platform, userId: string) {
      return prisma.subscription.findMany({
        where: { platform, userId },
        orderBy: { createdAt: "asc" },
      });
    },
    async update(id: string, platform: Platform, input: SubscriptionUpdate) {
      const { count } = await prisma.subscription.updateMany({
        where: { id, platform },
        data: input,
      });
      return count ? prisma.subscription.findUnique({ where: { id } }) : null;
    },
    async delete(id: string, platform: Platform) {
      const { count } = await prisma.subscription.deleteMany({ where: { id, platform } });
      return count === 1;
    },
  };
}

export type SubscriptionRepository = ReturnType<typeof createSubscriptionRepository>;
