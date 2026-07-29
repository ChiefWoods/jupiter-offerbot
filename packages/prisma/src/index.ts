import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export type PrismaClientConfig = {
  databaseUrl: string;
};

export function createPrismaClient({ databaseUrl }: PrismaClientConfig): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

export { Prisma } from "../generated/prisma/client";

export type {
  NotificationJob,
  NotificationJobStatus,
  Platform,
  Subscription,
} from "../generated/prisma/client";
