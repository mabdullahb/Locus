-- CreateIndex
CREATE INDEX "BusinessLead_sessionId_idx" ON "BusinessLead"("sessionId");

-- CreateIndex
CREATE INDEX "EnrichmentLog_leadId_idx" ON "EnrichmentLog"("leadId");

-- CreateIndex
CREATE INDEX "ExportHistory_userId_idx" ON "ExportHistory"("userId");

-- CreateIndex
CREATE INDEX "ExportHistory_sessionId_idx" ON "ExportHistory"("sessionId");

-- CreateIndex
CREATE INDEX "ProxySession_sessionId_idx" ON "ProxySession"("sessionId");

-- CreateIndex
CREATE INDEX "ScrapeSession_userId_idx" ON "ScrapeSession"("userId");
