-- Capture the actual failure reason for enrichment errors (was previously discarded)
ALTER TABLE "EnrichmentLog" ADD COLUMN "errorMessage" TEXT;
