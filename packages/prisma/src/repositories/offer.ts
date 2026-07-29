import type { PrismaClient } from "../../generated/prisma/client";

export type OfferCreatedInput = {
  offerAddress: string;
  mint: string;
  apy: number;
  signature: string;
  listedAt: string;
};

export type OfferIngestResult = { accepted: true; duplicate: boolean; queued: number };

export function createOfferRepository(prisma: PrismaClient) {
  return {
    async ingest(offer: OfferCreatedInput): Promise<OfferIngestResult> {
      const queued = await prisma.$transaction(async (tx) => {
        const subscriptions = await tx.subscription.findMany({
          where: { mint: offer.mint, OR: [{ maxApy: null }, { maxApy: { gte: offer.apy } }] },
          select: { id: true },
        });
        if (!subscriptions.length) return 0;
        return (
          await tx.notificationJob.createMany({
            data: subscriptions.map((subscription) => ({
              subscriptionId: subscription.id,
              offerAddress: offer.offerAddress,
              mint: offer.mint,
              apy: offer.apy,
              signature: offer.signature,
              listedAt: new Date(offer.listedAt),
            })),
            skipDuplicates: true,
          })
        ).count;
      });
      return { accepted: true, duplicate: queued === 0, queued };
    },
  };
}

export type OfferRepository = ReturnType<typeof createOfferRepository>;
