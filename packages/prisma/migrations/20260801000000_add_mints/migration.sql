-- CreateTable
CREATE TABLE "mints" (
    "mint" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "mints_pkey" PRIMARY KEY ("mint")
);

-- Backfill metadata rows before adding the foreign keys.
INSERT INTO "mints" ("mint")
SELECT "mint" FROM "subscriptions"
UNION
SELECT "mint" FROM "notification_jobs";

-- AddForeignKey
ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_mint_fkey"
FOREIGN KEY ("mint") REFERENCES "mints"("mint") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs"
ADD CONSTRAINT "notification_jobs_mint_fkey"
FOREIGN KEY ("mint") REFERENCES "mints"("mint") ON DELETE RESTRICT ON UPDATE CASCADE;
