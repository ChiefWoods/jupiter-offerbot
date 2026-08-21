-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('borrow', 'lend');

-- AlterTable
ALTER TABLE "subscriptions"
ADD COLUMN "type" "SubscriptionType" NOT NULL DEFAULT 'borrow';

-- Replace the uniqueness scope so each user can watch both offer types for a mint.
DROP INDEX "subscriptions_platform_user_id_mint_key";
CREATE UNIQUE INDEX "subscriptions_platform_user_id_mint_type_key"
ON "subscriptions"("platform", "user_id", "mint", "type");

-- Optimize offer-to-subscription matching.
CREATE INDEX "subscriptions_mint_type_idx" ON "subscriptions"("mint", "type");
