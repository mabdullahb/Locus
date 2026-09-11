-- AlterTable
ALTER TABLE "BusinessLead" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "timesSeen" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "BusinessLead_dedupeKey_idx" ON "BusinessLead"("dedupeKey");
