-- Dead weight from the Model A (credits/leads-per-month) pricing system.
-- Never actually decremented anywhere in the enrichment/extraction pipeline —
-- confirmed unused before dropping. BYOK pricing (see lib/billing/plans.ts)
-- gates on plan features and a computed monthly search count instead.
ALTER TABLE "User" DROP COLUMN "creditsRemaining";
ALTER TABLE "User" DROP COLUMN "creditsLimit";
ALTER TABLE "Subscription" DROP COLUMN "creditsLimit";
