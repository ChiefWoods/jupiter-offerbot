import type { PrismaClient } from "../../generated/prisma/client";

export type NotificationJobFailure = {
  attempts: number;
  lastError: string;
  availableAt?: Date;
};

export function createNotificationJobRepository(prisma: PrismaClient) {
  return {
    async claimPending(limit = 50) {
      return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM notification_jobs
          WHERE status = 'pending' AND available_at <= NOW()
          ORDER BY available_at
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        `;
        if (!rows.length) return [];

        const ids = rows.map((row) => row.id);
        await tx.notificationJob.updateMany({
          where: { id: { in: ids } },
          data: { status: "processing" },
        });
        return tx.notificationJob.findMany({
          where: { id: { in: ids } },
          include: { subscription: true },
        });
      });
    },
    async markDelivered(id: string) {
      await prisma.notificationJob.update({
        where: { id },
        data: { status: "delivered", deliveredAt: new Date() },
      });
    },
    async markFailed(id: string, failure: NotificationJobFailure) {
      await prisma.notificationJob.update({
        where: { id },
        data: failure.availableAt
          ? {
              attempts: failure.attempts,
              status: "pending",
              lastError: failure.lastError,
              availableAt: failure.availableAt,
            }
          : {
              attempts: failure.attempts,
              status: "failed",
              lastError: failure.lastError,
            },
      });
    },
  };
}

export type NotificationJobRepository = ReturnType<typeof createNotificationJobRepository>;
