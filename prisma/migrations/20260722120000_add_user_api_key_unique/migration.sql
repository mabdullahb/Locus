-- Add unique constraint for upsert compatibility
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_provider_key" UNIQUE ("userId", "provider");
