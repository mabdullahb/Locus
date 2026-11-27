// Browser-side Sentry. This used to live in sentry.client.config.ts, which
// Sentry's bundler plugin only injects for webpack builds. Next.js 16 builds
// with Turbopack, so that file was never bundled and browser errors were
// never reported. Next.js loads instrumentation-client.ts itself, before the
// app becomes interactive, on both bundlers.
import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "@/lib/sentry/data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: sentryDataCollection,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
});

// Lets Sentry trace App Router navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
