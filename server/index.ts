import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { decode } from "next-auth/jwt";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hybridEnrichLead, decryptApiKey, sanitizeLog, describeEnrichmentError } from "@/lib/enrichment";
import { verifySmtp } from "@/lib/enrichment/smtp-verifier";
import { parseLocale, filterByRadius, computeDedupeKey, type SearchResultItem } from "@/lib/search-utils";
import { verifyInternalSecret } from "@/lib/internal-auth";

const EMAIL_REGEXP = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Every search batch (initial run or "Load 100 more") fetches at most this
// many NEW results, then stops — no more silently paginating into the
// thousands. Users page in explicitly via /api/scrape/:sessionId/more.
const BATCH_SIZE = 100;

const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 4000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

// The /api/scrape/* endpoints below take a userId from the request body and
// queue work that spends that user's API credits. They are only ever called
// by the Next.js app, which attaches this shared secret. Without a matching
// secret the request is rejected, so the worker port is not an open job queue.
function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  if (!verifyInternalSecret(req.header("x-internal-secret"))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const scrapeQueue = new Queue("scrape-jobs", { connection });

interface ScrapeJobData {
  sessionId: string;
  userId: string;
  query: string;
  location: string;
  radius: string;
  concurrency: number;
  proxyType: string;
  enrichmentDepth: string;
  searchProvider?: string;
  locale?: string;
}

// Per-provider pagination state, persisted on ScrapeSession.config so a
// later "Load 100 more" call can resume from exactly where the last batch
// stopped instead of re-fetching or skipping results.
interface Continuation {
  serpNextStart?: number;
  serperNextPage?: number;
  googleNextPageToken?: string | null;
  [key: string]: unknown;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/api/scrape/start", requireInternalSecret, async (req, res) => {
  try {
    const { sessionId, userId, query, location, radius, concurrency, proxyType, enrichmentDepth, searchProvider, locale } = req.body as ScrapeJobData;

    const job = await scrapeQueue.add("scrape", {
      sessionId,
      userId,
      query,
      location,
      radius,
      concurrency,
      proxyType,
      enrichmentDepth,
      searchProvider,
      locale,
    } as ScrapeJobData);

    res.json({ jobId: job.id, sessionId });
  } catch {
    res.status(500).json({ error: "Failed to queue scrape job" });
  }
});

app.post("/api/scrape/more", requireInternalSecret, async (req, res) => {
  try {
    const { sessionId, userId } = req.body as { sessionId: string; userId: string };
    const job = await scrapeQueue.add("scrape-more", { sessionId, userId } as unknown as ScrapeJobData);
    res.json({ jobId: job.id, sessionId });
  } catch {
    res.status(500).json({ error: "Failed to queue continuation job" });
  }
});

const clients = new Map<string, Set<WebSocket>>();

// Pull the signed NextAuth session cookie off the WS handshake and return the
// user id it belongs to, or null. The worker has to be served from the same
// registrable domain as the app for the browser to send this cookie.
async function userIdFromCookie(cookieHeader: string | undefined): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!cookieHeader || !secret) return null;

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }

  // v5 renamed the default session cookie from next-auth.* to authjs.*, and
  // decode() now requires salt (Auth.js derives a per-cookie key from it),
  // conventionally the cookie's own name, same as the rest of the library
  // does internally.
  const cookieName = "authjs.session-token";
  const secureCookieName = "__Secure-authjs.session-token";
  const raw = cookies[cookieName] || cookies[secureCookieName];
  if (!raw) return null;

  try {
    const salt = cookies[secureCookieName] ? secureCookieName : cookieName;
    const token = await decode({ token: raw, secret, salt });
    return (token?.id as string | undefined) ?? (token?.sub as string | undefined) ?? null;
  } catch {
    return null;
  }
}

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("sessionId") || "global";

  const userId = await userIdFromCookie(req.headers.cookie);
  if (!userId) {
    ws.close(1008, "Unauthorized");
    return;
  }
  // A named scrape session's live feed carries that run's scraped leads and
  // enriched emails, so only its owner may subscribe.
  if (sessionId !== "global") {
    const owner = await prisma.scrapeSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!owner || owner.userId !== userId) {
      ws.close(1008, "Forbidden");
      return;
    }
  }

  if (!clients.has(sessionId)) clients.set(sessionId, new Set());
  clients.get(sessionId)!.add(ws);

  ws.on("close", () => {
    clients.get(sessionId)?.delete(ws);
    if (clients.get(sessionId)?.size === 0) clients.delete(sessionId);
  });
});

export function broadcast(sessionId: string, event: string, data: Record<string, unknown>) {
  const message = JSON.stringify({ event, data });
  clients.get(sessionId)?.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
  clients.get("global")?.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(message);
  });
}

interface SerpApiLocalResult {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  gps_coordinates?: { latitude?: number; longitude?: number };
  // SerpApi's Google Maps engine usually includes one or both of these on
  // each local_results item. Read defensively (both optional, both may be
  // absent), since the dedupe key falls back to name+location either way.
  place_id?: string;
  data_id?: string;
}

async function fetchSerpApiResults(
  serpApiKey: string, query: string, location: string, targetCount: number, startOffset: number,
  locale?: string,
): Promise<{ results: SearchResultItem[]; nextOffset: number; hasMore: boolean }> {
  if (!serpApiKey) throw new Error("SerpApi key is empty");

  const { hl, gl } = parseLocale(locale);
  const results: SearchResultItem[] = [];
  const FETCH_TIMEOUT = 30000;
  let start = startOffset;
  let hasMore = false;

  while (results.length < targetCount) {
    const url = `https://serpapi.com/search.json?engine=google_maps` +
      `&q=${encodeURIComponent(`${query} ${location}`)}` +
      `&api_key=${serpApiKey}&hl=${hl}&gl=${gl}&type=search` +
      (start > 0 ? `&start=${start}` : "");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SerpApi HTTP ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`SerpApi error: ${data.error}`);
    }

    const items: Array<SerpApiLocalResult> = data.local_results || [];
    start += 20;
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      results.push({
        title: item.title || "",
        address: item.address || "",
        phone: item.phone || null,
        website: item.website || null,
        placeId: item.place_id || item.data_id || null,
        rating: item.rating || null,
        reviews: item.reviews || null,
        lat: typeof item.gps_coordinates?.latitude === "number" ? item.gps_coordinates.latitude : null,
        lng: typeof item.gps_coordinates?.longitude === "number" ? item.gps_coordinates.longitude : null,
      });
      if (results.length >= targetCount) break;
    }

    hasMore = !!data.serpapi_pagination?.next;
    if (!hasMore || results.length >= targetCount) break;

    await new Promise((r) => setTimeout(r, 1000));
  }

  return { results, nextOffset: start, hasMore };
}

async function fetchSerperResults(
  serperKey: string, query: string, location: string, targetCount: number, startPage: number,
  locale?: string,
): Promise<{ results: SearchResultItem[]; nextPage: number; hasMore: boolean }> {
  if (!serperKey) throw new Error("Serper.dev key is empty");

  const { hl, gl } = parseLocale(locale);
  const results: SearchResultItem[] = [];
  const FETCH_TIMEOUT = 30000;
  let page = startPage;
  let hasMore = false;

  while (results.length < targetCount) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    // cid ("customer id", Google's own numeric place identifier) is read
    // defensively here, unconfirmed against a live Serper.dev key whether
    // their /places response actually includes it, same caveat as
    // SearchResultItem.placeId documents. Falls back to name+location
    // matching either way if it's absent.
    let data: { places?: Array<{ title?: string; address?: string; phoneNumber?: string; website?: string; rating?: number; ratingCount?: number; latitude?: number; longitude?: number; cid?: string }> };
    try {
      const res = await fetch("https://google.serper.dev/places", {
        method: "POST",
        signal: controller.signal,
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `${query} ${location}`, page, gl, hl }),
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Serper.dev HTTP ${res.status}: ${body.slice(0, 500)}`);
      }
      data = await res.json();
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error("Serper.dev request timed out");
      throw e;
    }

    const items = data.places || [];
    page += 1;
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
      results.push({
        title: item.title || "",
        address: item.address || "",
        phone: item.phoneNumber || null,
        placeId: item.cid || null,
        website: item.website || null,
        rating: item.rating || null,
        reviews: item.ratingCount || null,
        lat: typeof item.latitude === "number" ? item.latitude : null,
        lng: typeof item.longitude === "number" ? item.longitude : null,
      });
      if (results.length >= targetCount) break;
    }

    // Serper doesn't return an explicit "more pages" flag — a full page
    // (typically 10 results) suggests there may be another; a short page
    // means we've hit the end of what the provider has for this query.
    hasMore = items.length >= 10;
    if (!hasMore || results.length >= targetCount) break;
  }

  return { results, nextPage: page, hasMore };
}

async function fetchGooglePlacesResults(
  apiKey: string, query: string, location: string, targetCount: number, startPageToken: string | null,
  locale?: string,
): Promise<{ results: SearchResultItem[]; nextPageToken: string | null; hasMore: boolean }> {
  if (!apiKey) throw new Error("Google Places API key is empty");

  const { hl, gl } = parseLocale(locale);
  const results: SearchResultItem[] = [];
  let pageToken: string | null = startPageToken;
  let hasMore = false;

  do {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // A pagetoken request can only carry pagetoken+key — Google rejects
    // extra params on it, and the language/region context from the original
    // search already carries through via the token itself.
    const searchUrl = pageToken
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${pageToken}&key=${apiKey}`
      : `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(`${query} ${location}`)}&language=${hl}&region=${gl}&key=${apiKey}`;

    let searchData: { results?: Array<{ place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number; geometry?: { location?: { lat?: number; lng?: number } } }>; next_page_token?: string; status: string };
    try {
      const searchRes = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!searchRes.ok) {
        const body = await searchRes.text().catch(() => "");
        throw new Error(`Google Places HTTP ${searchRes.status}: ${body.slice(0, 500)}`);
      }
      searchData = await searchRes.json();

      if (searchData.status === "INVALID_REQUEST" && pageToken) {
        // The next_page_token isn't active yet immediately after being
        // issued — Google's documented fix is a short retry delay.
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (searchData.status !== "OK" || !searchData.results) {
        throw new Error(`Google Places API error: status=${searchData.status}`);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new Error("Google Places API request timed out");
      throw e;
    }

    for (const place of searchData.results) {
      if (results.length >= targetCount) break;

      const detailController = new AbortController();
      const detailTimeout = setTimeout(() => detailController.abort(), 10000);
      const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total` +
        `&key=${apiKey}`;

      let detailData: { result?: { formatted_phone_number?: string; website?: string }; status: string } = { status: "UNKNOWN" };
      try {
        const detailRes = await fetch(detailUrl, { signal: detailController.signal });
        clearTimeout(detailTimeout);
        if (detailRes.ok) {
          detailData = await detailRes.json();
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw new Error("Google Places API request timed out");
        // A single failed detail lookup shouldn't discard an otherwise-valid
        // place — fall through with null phone/website for this one.
      }

      results.push({
        title: place.name,
        address: place.formatted_address,
        placeId: place.place_id || null,
        phone: detailData.result?.formatted_phone_number || null,
        website: detailData.result?.website || null,
        rating: place.rating || null,
        reviews: place.user_ratings_total || null,
        lat: typeof place.geometry?.location?.lat === "number" ? place.geometry.location.lat : null,
        lng: typeof place.geometry?.location?.lng === "number" ? place.geometry.location.lng : null,
      });

      await new Promise((r) => setTimeout(r, 200));
    }

    pageToken = searchData.next_page_token ?? null;
    hasMore = !!pageToken;
  } while (results.length < targetCount && pageToken);

  return { results, nextPageToken: pageToken, hasMore };
}

// Cooperative cancellation: /api/scrape/[sessionId]/cancel just flips this
// column to "aborted" — no direct BullMQ access needed from the Next.js
// process. The worker checks it here before starting the (potentially long)
// enrichment loop and again on every iteration, so a cancel takes effect
// within one enrichment call instead of waiting for the whole job to finish.
async function isCancelled(sessionId: string): Promise<boolean> {
  const s = await prisma.scrapeSession.findUnique({ where: { id: sessionId }, select: { status: true } });
  return s?.status !== "running";
}

async function runSearchBatch(
  provider: string, key: string, query: string, location: string, continuation: Continuation,
  locale?: string,
): Promise<{ results: SearchResultItem[]; continuation: Continuation; hasMore: boolean }> {
  if (provider === "google_places") {
    const { results, nextPageToken, hasMore } = await fetchGooglePlacesResults(
      key, query, location, BATCH_SIZE, continuation.googleNextPageToken ?? null, locale,
    );
    return { results, continuation: { googleNextPageToken: nextPageToken }, hasMore };
  }
  if (provider === "serper") {
    const { results, nextPage, hasMore } = await fetchSerperResults(
      key, query, location, BATCH_SIZE, continuation.serperNextPage ?? 1, locale,
    );
    return { results, continuation: { serperNextPage: nextPage }, hasMore };
  }
  const { results, nextOffset, hasMore } = await fetchSerpApiResults(
    key, query, location, BATCH_SIZE, continuation.serpNextStart ?? 0, locale,
  );
  return { results, continuation: { serpNextStart: nextOffset }, hasMore };
}

new Worker<ScrapeJobData>(
  "scrape-jobs",
  async (job) => {
    const isInitial = job.name !== "scrape-more";
    const { sessionId, userId } = job.data;

    let query = job.data.query;
    let location = job.data.location;
    let radius = job.data.radius || "25";
    let locale = job.data.locale || "en-US";
    let searchProvider = job.data.searchProvider || "serpapi";
    let continuation: Continuation = {};
    let priorLocationsFound = 0;
    let priorPhonesFound = 0;
    let priorDuration = 0;

    try {
      if (isInitial) {
        await prisma.scrapeSession.create({
          data: {
            id: sessionId,
            userId,
            query,
            location,
            radius: job.data.radius || "25",
            concurrency: job.data.concurrency || 8,
            proxyType: job.data.proxyType || "residential",
            status: "running",
            config: { enrichmentDepth: job.data.enrichmentDepth, searchProvider, locale, continuation: {}, hasMore: false },
          },
        });
      } else {
        const existing = await prisma.scrapeSession.findUnique({ where: { id: sessionId } });
        if (!existing) throw new Error("Session not found for continuation");
        query = existing.query;
        location = existing.location;
        radius = existing.radius;
        priorDuration = existing.duration ?? 0;
        const cfg = (existing.config as Record<string, unknown>) || {};
        searchProvider = (cfg.searchProvider as string) || "serpapi";
        locale = (cfg.locale as string) || "en-US";
        continuation = (cfg.continuation as Continuation) || {};

        await prisma.scrapeSession.update({ where: { id: sessionId }, data: { status: "running" } });

        priorLocationsFound = await prisma.businessLead.count({ where: { sessionId } });
        priorPhonesFound = await prisma.businessLead.count({ where: { sessionId, phone: { not: null } } });
      }

      broadcast(sessionId, "stage", { stage: "initializing", progress: 2 });
      broadcast(sessionId, "stage", { stage: "navigating", progress: 10 });
      await new Promise((r) => setTimeout(r, 500));
      broadcast(sessionId, "stage", { stage: "parsing", progress: 30 });

      const extractionKeyRecord = await prisma.userApiKey.findFirst({
        where: { userId, provider: searchProvider, isActive: true },
      });
      if (!extractionKeyRecord) {
        throw new Error(
          `No ${searchProvider} key configured. Add one in Settings > API Keys before running an extraction.`,
        );
      }
      const extractionKey = decryptApiKey(extractionKeyRecord.encryptedKey);

      const batch = await runSearchBatch(searchProvider, extractionKey, query, location, continuation, locale);
      batch.results = filterByRadius(batch.results, radius);
      // Providers occasionally omit an address for a given result (confirmed
      // with Serper.dev) — a lead with no location at all can't be verified,
      // visited, or told apart from another same-named business elsewhere,
      // so it's not worth saving. Applies to whichever provider is active;
      // a provider that always returns an address (Google Places does,
      // reliably) simply never trips this filter.
      batch.results = batch.results.filter((r) => r.address && r.address.trim() !== "");

      // Deep pagination on some providers (confirmed with Serper.dev) starts
      // re-returning the same business+address once the underlying result
      // set is exhausted, rather than a clean empty page. Also, and this
      // used to only check the current session, re-running a similar
      // search over an area already searched before would re-save the same
      // businesses as brand-new rows: one correctly verified from the
      // earlier run, one fresh and unenriched from this one, both showing
      // up side by side in the leads table with no visible link between
      // them. Checking the user's entire lead history instead of just this
      // session catches both cases with the same key.
      //
      // Read-then-insert here isn't atomic on its own. A second worker
      // process (horizontal scaling, a common production deployment for
      // this exact BullMQ setup) racing the same check against the same
      // user could each decide the same business is "new" before either
      // has inserted, creating true duplicate leads with nothing at the
      // database level to catch it. pg_advisory_xact_lock is visible across
      // every connection/process talking to this database, not just within
      // this one Node process, so it closes the race even under multiple
      // worker instances, and it's released automatically when the
      // transaction ends either way. Capped at the same 5000 as
      // /api/leads (see that route's comment) rather than scanning a whole
      // account's history unbounded forever.
      const results: SearchResultItem[] = [];
      let newLeads: { id: string; businessName: string; location: string; phone: string | null; website: string | null; lat: number | null; lng: number | null; status: string }[] = [];
      let reFoundCount = 0;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;

        const existingLeads = await tx.businessLead.findMany({
          where: { session: { userId } },
          select: { id: true, businessName: true, location: true, dedupeKey: true, phone: true, website: true },
          orderBy: { createdAt: "desc" },
          take: 5000,
        });
        // Rows saved before dedupeKey existed have it stored as null. Fall
        // back to computing the same normalized key on the fly for those,
        // rather than requiring a backfill migration before matching works
        // against pre-existing data.
        const existingByKey = new Map(
          existingLeads.map((l) => [
            l.dedupeKey ?? computeDedupeKey({ placeId: null, title: l.businessName, address: l.location }),
            l,
          ]),
        );

        const reFinds: { id: string; phone: string | null; website: string | null; incomingPhone: string | null; incomingWebsite: string | null }[] = [];
        const seenThisBatch = new Set<string>();
        for (const r of batch.results) {
          const key = computeDedupeKey(r);
          // Within-batch duplicates (the same place turning up twice in one
          // search's own results) are dropped outright, same as before.
          // There's nothing meaningful to "re-find" against a lead that
          // doesn't exist yet.
          if (seenThisBatch.has(key)) continue;
          seenThisBatch.add(key);

          const existing = existingByKey.get(key);
          if (existing) {
            reFinds.push({
              id: existing.id,
              phone: existing.phone,
              website: existing.website,
              incomingPhone: r.phone,
              incomingWebsite: r.website,
            });
            continue;
          }
          results.push(r);
        }

        if (reFinds.length > 0) {
          reFoundCount = reFinds.length;
          await Promise.all(
            reFinds.map((f) =>
              tx.businessLead.update({
                where: { id: f.id },
                data: {
                  timesSeen: { increment: 1 },
                  lastSeenAt: new Date(),
                  // Backfill only what was missing before. Never overwrite
                  // a phone/website this lead already had with a re-find's
                  // value, since the earlier one may already be enriched
                  // or manually corrected.
                  ...(f.phone ? {} : { phone: f.incomingPhone }),
                  ...(f.website ? {} : { website: f.incomingWebsite }),
                },
              }),
            ),
          );
        }

        if (results.length > 0) {
          newLeads = await Promise.all(
            results.map((r) =>
              tx.businessLead.create({
                data: {
                  sessionId,
                  businessName: r.title,
                  location: r.address,
                  phone: r.phone,
                  website: r.website,
                  lat: r.lat,
                  lng: r.lng,
                  status: "pending",
                  dedupeKey: computeDedupeKey(r),
                },
              }),
            ),
          );
        }
      });

      if (reFoundCount > 0) {
        console.log(`Session ${sessionId}: ${reFoundCount} result(s) matched a business already known from an earlier search, updated rather than duplicated.`);
      }

      const cumulativeLocationsFound = priorLocationsFound + results.length;
      const cumulativePhonesFound = priorPhonesFound + results.filter((r) => r.phone).length;

      broadcast(sessionId, "stage", {
        stage: results.length > 0 ? "enriching" : "formatting",
        progress: results.length > 0 ? 60 : 80,
        metrics: { locationsFound: cumulativeLocationsFound, phonesExtracted: cumulativePhonesFound },
      });

      let priorVerified = 0;
      if (results.length > 0) {
        priorVerified = await prisma.businessLead.count({ where: { sessionId, status: "verified" } });

        const userApiKey = await prisma.userApiKey.findFirst({
          where: { userId, isActive: true, provider: { in: ["gemini", "anthropic", "openai", "openrouter", "9router"] } },
          // Exactly one of these should ever be active at a time (enforced on
          // save in /api/settings/ai-key). If that invariant is ever
          // violated, prefer the most recently saved key over Postgres's
          // unspecified row order, so behavior stays predictable instead of
          // silently swapping providers between runs.
          orderBy: { createdAt: "desc" },
        });
        // Optional and independent of the above: a user can have this
        // configured or not, regardless of which AI provider they use.
        const hunterKeyRecord = await prisma.userApiKey.findFirst({
          where: { userId, isActive: true, provider: "hunter" },
        });
        const hunterApiKey = hunterKeyRecord ? decryptApiKey(hunterKeyRecord.encryptedKey) : undefined;

        if (userApiKey && !(await isCancelled(sessionId))) {
          const decryptedKey = decryptApiKey(userApiKey.encryptedKey);
          let enrichedInBatch = 0;
          let processedInBatch = 0;
          let phonesFoundInBatch = 0;
          // Measured against this deployment's actual 9Router setup (self-
          // hosted): individual LLM calls ranged 5-13s, with the search-
          // snippet call consistently 9-13s. A lead with a website that
          // still needs the search fallback chains website-fetch + LLM call
          // + Serper search + a second LLM call — worst observed case adds
          // up to ~40s, well past the old 30s ceiling, causing real
          // (recoverable, not actually broken) enrichments to be marked
          // "failed" purely from running out of time.
          const ENRICHMENT_TIMEOUT = 60000;
          // Was one lead at a time (the reported 8-minute run for 100 leads).
          // Each lead can involve up to 2 HTTP fetches + 2 LLM calls
          // (lib/enrichment/strategies.ts's website-then-search fallback).
          // Lowered from 8: a self-hosted router has far less headroom than
          // a hosted provider, and the timing data above was gathered while
          // 8 ran at once — fewer concurrent requests against the same
          // router should mean less internal queuing/contention per call.
          const ENRICHMENT_CONCURRENCY = 4;

          const enrichOne = async (lead: (typeof newLeads)[number]) => {
            // Captured for the real-time "lead-updated" broadcast in finally —
            // the table previously only learned a lead's real status from the
            // "complete" event at the very end of the whole batch (or a full
            // page reload), so a long-running extraction showed every lead
            // stuck on "Pending" until the user navigated away and back.
            let outcomeStatus: "verified" | "needs_enrich" | "failed" = "needs_enrich";
            let outcomeEmail: string | null = null;
            try {
              const result = await Promise.race([
                hybridEnrichLead(
                  userId,
                  userApiKey.provider as "gemini" | "anthropic" | "openai" | "openrouter" | "9router",
                  decryptedKey,
                  lead.businessName,
                  lead.website,
                  lead.location,
                  extractionKey,
                  userApiKey.model ?? undefined,
                  searchProvider,
                  hunterApiKey,
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("Enrichment timeout")), ENRICHMENT_TIMEOUT),
                ),
              ]);

              // LLM-derived value, never trust it's a well-formed email before persisting/marking verified.
              const validEmail = result.email && EMAIL_REGEXP.test(result.email) ? result.email : null;

              await prisma.enrichmentLog.create({
                data: {
                  leadId: lead.id,
                  source: result.source,
                  resultStatus: validEmail ? "found" : "not_found",
                  emailFound: !!validEmail,
                  apiCostCredits: validEmail ? 1 : 0,
                },
              });

              if (validEmail) {
                enrichedInBatch++;
                // Enrichment can discover a phone number the initial search
                // results didn't have (result.phone), same source as the
                // email. The live "Phones Extracted" counter below was
                // otherwise frozen at the pre-enrichment search-stage count
                // for the rest of the run, undercounting real phones that
                // did make it into the database via the update just below.
                if (result.phone && !lead.phone) {
                  phonesFoundInBatch++;
                }
                // A real SMTP check on top of the AI's answer, not a
                // replacement for it: only a confirmed rejection (the
                // mailbox provably doesn't exist) downgrades the outcome.
                // "confirmed" and "inconclusive" (the far more common case,
                // most cloud hosts block outbound port 25 entirely) both
                // leave the AI's verdict standing, since this check has no
                // way to positively prove correctness, only to disprove it.
                let smtpResult: Awaited<ReturnType<typeof verifySmtp>>;
                try {
                  smtpResult = await verifySmtp(validEmail);
                } catch (smtpErr) {
                  smtpResult = { outcome: "inconclusive", detail: `smtp check threw: ${(smtpErr as Error).message}` };
                }
                await prisma.enrichmentLog.create({
                  data: {
                    leadId: lead.id,
                    source: "smtp-verify",
                    resultStatus: smtpResult.outcome,
                    emailFound: smtpResult.outcome !== "rejected",
                    apiCostCredits: 0,
                    errorMessage: smtpResult.outcome === "confirmed" ? null : sanitizeLog(smtpResult.detail).slice(0, 500),
                  },
                });

                if (smtpResult.outcome === "rejected") {
                  outcomeStatus = "needs_enrich";
                  await prisma.businessLead.update({
                    where: { id: lead.id },
                    data: {
                      // Keep the discovered email visible, it's real data,
                      // a person may still want to see or manually check
                      // it. Just don't claim it's verified when the
                      // mailbox itself said otherwise.
                      email: validEmail,
                      phone: result.phone || lead.phone,
                      status: "needs_enrich",
                      emailVerified: false,
                    },
                  }).catch(() => {});
                } else {
                  outcomeStatus = "verified";
                  outcomeEmail = validEmail;
                  await prisma.businessLead.update({
                    where: { id: lead.id },
                    data: {
                      email: validEmail,
                      phone: result.phone || lead.phone,
                      status: "verified",
                      emailVerified: true,
                    },
                  });
                }
              } else {
                // Enrichment ran cleanly and genuinely found nothing — mark
                // as needs_enrich (attempted, retryable) rather than leaving
                // it at "pending" forever, which is indistinguishable from
                // "never touched at all."
                outcomeStatus = "needs_enrich";
                await prisma.businessLead.update({
                  where: { id: lead.id },
                  data: { status: "needs_enrich" },
                }).catch(() => {});
              }
            } catch (err) {
              const message = sanitizeLog(describeEnrichmentError(err)).slice(0, 500);
              console.error(`Enrichment failed for lead ${lead.id} (${lead.businessName}):`, message);
              outcomeStatus = "failed";
              await prisma.enrichmentLog.create({
                data: {
                  leadId: lead.id,
                  source: "error",
                  resultStatus: "error",
                  emailFound: false,
                  apiCostCredits: 0,
                  errorMessage: message,
                },
              }).catch(() => {});
              // The attempt genuinely failed (provider error, rate limit,
              // timeout) — mark it "failed" so it's visibly distinct from a
              // lead that hasn't been processed yet.
              await prisma.businessLead.update({
                where: { id: lead.id },
                data: { status: "failed" },
              }).catch(() => {});
            } finally {
              processedInBatch++;
              broadcast(sessionId, "lead-updated", {
                id: lead.id,
                status: outcomeStatus,
                email: outcomeEmail,
              });
              const pct = Math.round(60 + (processedInBatch / newLeads.length) * 25);
              broadcast(sessionId, "stage", {
                stage: "enriching",
                progress: pct,
                metrics: {
                  locationsFound: cumulativeLocationsFound,
                  phonesExtracted: cumulativePhonesFound + phonesFoundInBatch,
                  emailsVerified: priorVerified + enrichedInBatch,
                  fullyEnriched: priorVerified + enrichedInBatch,
                },
              });
            }
          };

          for (let i = 0; i < newLeads.length; i += ENRICHMENT_CONCURRENCY) {
            if (await isCancelled(sessionId)) {
              broadcast(sessionId, "aborted", { message: "Extraction cancelled" });
              return { sessionId, cancelled: true };
            }
            const batch = newLeads.slice(i, i + ENRICHMENT_CONCURRENCY);
            await Promise.allSettled(batch.map(enrichOne));
          }
        }
      }

      if (await isCancelled(sessionId)) {
        broadcast(sessionId, "aborted", { message: "Extraction cancelled" });
        return { sessionId, cancelled: true };
      }

      broadcast(sessionId, "stage", { stage: "formatting", progress: 90 });

      const batchDuration = Math.floor((Date.now() - job.timestamp) / 1000);
      await prisma.scrapeSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          totalYield: cumulativeLocationsFound,
          completedAt: new Date(),
          duration: priorDuration + batchDuration,
          config: {
            enrichmentDepth: job.data.enrichmentDepth,
            searchProvider,
            locale,
            continuation: JSON.parse(JSON.stringify(batch.continuation)),
            hasMore: batch.hasMore,
          },
        },
      });

      const finalLeads = await prisma.businessLead.findMany({
        where: { sessionId },
        // id was missing here — the client (hooks/useScrapeWebSocket.ts's
        // mapLeads) falls back to a synthetic "ws-<timestamp>-<i>" id when
        // item.id is absent, which doesn't exist in the DB. Every lead added
        // to the table via a live extraction's "complete" broadcast got one
        // of those fake ids, so clicking "View" on it 404'd against
        // /api/leads/[id] — "Failed to load lead details" on every attempt.
        select: { id: true, phone: true, email: true, status: true, businessName: true, location: true, website: true },
      });
      const phonesInDb = finalLeads.filter((l) => l.phone).length;
      const emailsInDb = finalLeads.filter((l) => l.email).length;
      const verifiedInDb = finalLeads.filter((l) => l.status === "verified").length;

      await new Promise((r) => setTimeout(r, 300));
      broadcast(sessionId, "complete", {
        sessionId,
        totalYield: finalLeads.length,
        phonesExtracted: phonesInDb,
        emailsVerified: emailsInDb,
        fullyEnriched: verifiedInDb,
        hasMore: batch.hasMore,
        leads: finalLeads,
      });
      return { sessionId, totalYield: finalLeads.length, leads: finalLeads };
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      await prisma.scrapeSession.update({
        where: { id: sessionId },
        data: {
          status: "failed",
          errorLog: message,
          completedAt: new Date(),
        },
      }).catch(() => {});

      broadcast(sessionId, "error", { message });
      throw err;
    }
  },
  { connection },
);

// A ScrapeSession stuck at "running" means the worker that owned it is gone
// (crashed, or this process itself just restarted, e.g. tsx watch on a file
// save) before its own try/catch could mark it "completed" or "failed". The
// client can't recover on its own either: the WebSocket
// (hooks/useScrapeWebSocket.ts) has no reconnect logic, and its reconcile
// poll only reads this same Postgres row, so it just keeps seeing "running"
// forever too. Nothing else in this codebase ever un-sticks that row, so the
// dashboard is left frozen on the last-seen stage indefinitely with no
// error, which reads as the extraction having silently gone blank.
const STALE_RUNNING_MS = 15 * 60 * 1000;
const STALE_MESSAGE = "Extraction did not finish (the background worker restarted or crashed). Please retry.";

async function failStaleSessions(where: Prisma.ScrapeSessionWhereInput) {
  const stale = await prisma.scrapeSession.findMany({ where, select: { id: true } });
  if (stale.length === 0) return;
  await prisma.scrapeSession.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "failed", errorLog: STALE_MESSAGE, completedAt: new Date() },
  });
  for (const s of stale) {
    broadcast(s.id, "error", { message: STALE_MESSAGE });
  }
  console.log(`Marked ${stale.length} orphaned "running" session(s) as failed.`);
}

// On boot, this process owns zero in-flight jobs by definition, so every
// "running" row left over from before the restart is orphaned right now,
// regardless of age.
failStaleSessions({ status: "running" }).catch((e) =>
  console.error("Startup sweep of orphaned sessions failed:", e),
);

// Ongoing safety net for a job that hangs or dies without the process itself
// restarting (e.g. an uncaught crash in a single worker callback). Threshold
// is generous relative to the ~10 largest observed batch runtime, so it never
// fires on a genuinely still-running extraction.
setInterval(() => {
  failStaleSessions({
    status: "running",
    startedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) },
  }).catch((e) => console.error("Stale-session sweep failed:", e));
}, 5 * 60 * 1000);

// Every /api/scrape/* endpoint here trusts a client-supplied userId, gated
// only by the shared secret in requireInternalSecret. That's an acceptable
// trust boundary only as long as this port is reachable exclusively from
// the Next.js app it's paired with, not the open network. Node's
// server.listen(port) with no host binds all interfaces (0.0.0.0) by
// default. Fine behind a firewall or security group, but a real gap if one
// is ever misconfigured. Defaults to that same current behavior so nothing
// breaks. Set SERVER_HOST=127.0.0.1 when the Next.js app and this worker
// always run on the same host, which is the common case.
const HOST = process.env.SERVER_HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Locus server running on ${HOST}:${PORT}`);
});
