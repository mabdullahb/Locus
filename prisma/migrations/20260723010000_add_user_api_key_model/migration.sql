-- Per-key model selection (used by providers like OpenRouter that route to many underlying models)
ALTER TABLE "UserApiKey" ADD COLUMN "model" TEXT;
