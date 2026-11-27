import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "@/lib/sentry/data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0.1,
});
