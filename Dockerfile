# Next.js app image. The background worker (search + enrichment) is a
# separate process with its own Dockerfile.worker, run as its own service in
# docker-compose.yml, not part of this image.

ARG NODE_VERSION=24.20.0-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
# node:*-slim doesn't include OpenSSL, which Prisma's engines need to detect
# the right binary target for. Without it, prisma generate still runs but
# warns and silently guesses a target.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* variables are inlined into the browser bundle at build time,
# not read at container startup, so they have to be supplied here as build
# arguments rather than as regular docker-compose environment: entries.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NODE_ENV=production

# Prisma's client (custom output path lib/generated/prisma) has to exist
# before `next build`, Next.js's build-time file tracing needs the real
# generated files present to know what to include in the standalone output.
RUN npx prisma generate
RUN npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Needed here too since `prisma migrate deploy` runs from this stage's own
# image at container startup (see CMD below), not just at build time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma migrations run separately (see docker-compose.yml), but the CLI and
# schema still need to be in the image for `prisma migrate deploy` to run
# from inside this container at startup. The standalone output only carries
# node_modules traced for the app's own runtime, which excludes the prisma
# CLI entirely. Copying the full deps node_modules (rather than cherry-
# picking node_modules/.bin/prisma) is required here: that .bin entry is a
# symlink to ../prisma/build/index.js, and Docker COPY dereferences symlinks
# into plain file copies, which breaks index.js's own `require('./cli.js')`
# once it's no longer sitting next to prisma/build/cli.js.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# schema.prisma has no datasource url (this project reads it from
# prisma.config.ts at the repo root, not from prisma/), so that file has to
# come along too or `prisma migrate deploy` fails with "datasource.url
# property is required".
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# Applies any new migrations before the app starts serving traffic, so a
# `docker compose up` on a fresh database (or after pulling an image with
# schema changes) doesn't come up against a database Prisma doesn't
# recognize yet.
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
