import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  // Produces a self-contained .next/standalone folder (app code plus only
  // the node_modules it actually needs) instead of requiring the full
  // project and node_modules in the final image. Needed for the Dockerfile
  // to build a lean production image rather than shipping the whole repo.
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      // Dev-mode chunk filenames aren't content-hashed the way production
      // build output is, so forcing an immutable year-long cache here too
      // means any chunk the browser has already fetched stays stuck even
      // after the dev server recompiles — edits stop showing up until the
      // browser cache is cleared. Only safe to do once filenames are hashed.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/_next/static/(.*)",
              headers: [
                { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
              ],
            },
          ]
        : []),
    ];
  },
};

// Turbopack is the default bundler for both `next dev` and `next build` as
// of Next.js 16, no CLI flag needed. The Sentry SDK requires Next.js 15.4.1+
// for Turbopack support, satisfied on the current 16.3.4.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT || "locus",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
