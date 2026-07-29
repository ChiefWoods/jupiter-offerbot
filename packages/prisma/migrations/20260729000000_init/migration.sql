-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('discord', 'telegram');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('pending', 'processing', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "user_id" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "max_apy" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "offer_address" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "apy" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "listed_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_platform_user_id_mint_key" ON "subscriptions"("platform", "user_id", "mint");

-- CreateIndex
CREATE INDEX "notification_jobs_ready_idx" ON "notification_jobs"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_subscription_id_offer_address_key" ON "notification_jobs"("subscription_id", "offer_address");

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
