-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('completed', 'failed', 'aborted', 'running');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('verified', 'needs_enrich', 'pending', 'failed');

-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('starter', 'professional', 'business', 'enterprise');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "planType" "UserPlan" NOT NULL DEFAULT 'starter',
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "radius" TEXT NOT NULL DEFAULT '25',
    "concurrency" INTEGER NOT NULL DEFAULT 8,
    "proxyType" TEXT NOT NULL DEFAULT 'residential',
    "status" "SessionStatus" NOT NULL DEFAULT 'running',
    "totalYield" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "errorLog" TEXT,
    "config" JSONB NOT NULL,

    CONSTRAINT "ScrapeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLead" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "category" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" "LeadStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "resultStatus" TEXT NOT NULL,
    "emailFound" BOOLEAN NOT NULL DEFAULT false,
    "apiCostCredits" DOUBLE PRECISION DEFAULT 0,
    "enrichedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxySession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "proxyIp" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION,
    "requestsMade" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProxySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileSize" INTEGER,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- AddForeignKey
ALTER TABLE "ScrapeSession" ADD CONSTRAINT "ScrapeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessLead" ADD CONSTRAINT "BusinessLead_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScrapeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentLog" ADD CONSTRAINT "EnrichmentLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "BusinessLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxySession" ADD CONSTRAINT "ProxySession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScrapeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScrapeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
