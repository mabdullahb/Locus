-- DropForeignKey
ALTER TABLE "ExportHistory" DROP CONSTRAINT "ExportHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "ScrapeSession" DROP CONSTRAINT "ScrapeSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserApiKey" DROP CONSTRAINT "UserApiKey_userId_fkey";

-- AddForeignKey
ALTER TABLE "ScrapeSession" ADD CONSTRAINT "ScrapeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
