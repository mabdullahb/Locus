import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "@/lib/db";
import { hybridEnrichLead, decryptApiKey } from "@/lib/enrichment";

const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 4000;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

const app = express();
app.use(cors());
app.use(express.json());

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
  maxResults: number;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/api/scrape/start", async (req, res) => {
  try {
    const { sessionId, userId, query, location, radius, concurrency, proxyType, enrichmentDepth, maxResults } = req.body as ScrapeJobData;

    const job = await scrapeQueue.add("scrape", {
      sessionId,
      userId,
      query,
      location,
      radius,
      concurrency,
      proxyType,
      enrichmentDepth,
      maxResults,
    } as ScrapeJobData);

    res.json({ jobId: job.id, sessionId });
  } catch (err) {
    res.status(500).json({ error: "Failed to queue scrape job" });
  }
});

const clients = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const sessionId = url.searchParams.get("sessionId") || "global";

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

async function fetchSerpApiResults(query: string, location: string, maxResults: number) {
  if (!SERPAPI_KEY) return [];

  const results: Array<{
    title: string; address: string; phone: string | null;
    website: string | null; rating: number | null; reviews: number | null;
  }> = [];

  for (let start = 0; results.length < maxResults; start += 20) {
    const url = `https://serpapi.com/search.json?engine=google_maps` +
      `&q=${encodeURIComponent(`${query} ${location}`)}` +
      `&api_key=${SERPAPI_KEY}&hl=en&type=search` +
      (start > 0 ? `&start=${start}` : "");

    const res = await fetch(url);
    const data = await res.json();

    const items: Array<any> = data.local_results || [];
    if (items.length === 0) break;

    for (const item of items) {
      results.push({
        title: item.title || "",
        address: item.address || "",
        phone: item.phone || null,
        website: item.website || null,
        rating: item.rating || null,
        reviews: item.reviews || null,
      });
      if (results.length >= maxResults) break;
    }

    if (data.serpapi_pagination?.next) {
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      break;
    }
  }

  return results;
}

new Worker<ScrapeJobData>(
  "scrape-jobs",
  async (job) => {
    const { sessionId, userId, query, location, maxResults, radius, concurrency, proxyType } = job.data;

    try {
      await prisma.scrapeSession.create({
        data: {
          id: sessionId,
          userId,
          query,
          location,
          radius: radius || "25",
          concurrency: concurrency || 8,
          proxyType: proxyType || "residential",
          status: "running",
          config: { maxResults, enrichmentDepth: job.data.enrichmentDepth },
        },
      });

      broadcast(sessionId, "stage", { stage: "initializing", progress: 2 });

      broadcast(sessionId, "stage", { stage: "navigating", progress: 10 });
      await new Promise((r) => setTimeout(r, 500));

      broadcast(sessionId, "stage", { stage: "parsing", progress: 30 });
      const results = await fetchSerpApiResults(query, location, maxResults || 100);

      broadcast(sessionId, "stage", {
        stage: results.length > 0 ? "enriching" : "formatting",
        progress: results.length > 0 ? 60 : 80,
        metrics: { locationsFound: results.length },
      });

      broadcast(sessionId, "stage", { stage: "formatting", progress: 90 });

      if (results.length > 0) {
        await prisma.businessLead.createMany({
          data: results.map((r) => ({
            sessionId,
            businessName: r.title,
            location: r.address,
            phone: r.phone,
            website: r.website,
            status: "pending",
          })),
        });

        const userApiKey = await prisma.userApiKey.findFirst({
          where: { userId, isActive: true },
        });

        if (userApiKey) {
          const leadsInDb = await prisma.businessLead.findMany({
            where: { sessionId },
          });

          const decryptedKey = decryptApiKey(userApiKey.encryptedKey);
          let enriched = 0;

          const ENRICHMENT_TIMEOUT = 30000;

          for (const lead of leadsInDb) {
            try {
              const result = await Promise.race([
                hybridEnrichLead(
                  userId,
                  userApiKey.provider as "gemini" | "anthropic" | "openai",
                  decryptedKey,
                  lead.businessName,
                  lead.website,
                  lead.location,
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error("Enrichment timeout")), ENRICHMENT_TIMEOUT),
                ),
              ]);

              await prisma.enrichmentLog.create({
                data: {
                  leadId: lead.id,
                  source: result.source,
                  resultStatus: result.email ? "found" : "not_found",
                  emailFound: !!result.email,
                  apiCostCredits: result.email ? 1 : 0,
                },
              });

              if (result.email) {
                enriched++;
                await prisma.businessLead.update({
                  where: { id: lead.id },
                  data: {
                    email: result.email,
                    phone: result.phone || lead.phone,
                    status: "verified",
                    emailVerified: true,
                  },
                });
              }

              const pct = Math.round(60 + (enriched / leadsInDb.length) * 25);
              broadcast(sessionId, "stage", {
                stage: "enriching",
                progress: pct,
                metrics: {
                  locationsFound: results.length,
                  phonesExtracted: results.filter((r) => r.phone).length,
                  emailsVerified: enriched,
                  fullyEnriched: enriched,
                },
              });
            } catch {
              await prisma.enrichmentLog.create({
                data: {
                  leadId: lead.id,
                  source: "error",
                  resultStatus: "error",
                  emailFound: false,
                  apiCostCredits: 0,
                },
              }).catch(() => {});
            }
          }
        }
      }

      const duration = Math.floor((Date.now() - job.timestamp) / 1000);
      await prisma.scrapeSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          totalYield: results.length,
          completedAt: new Date(),
          duration,
        },
      });

      await new Promise((r) => setTimeout(r, 300));
      broadcast(sessionId, "complete", {
        sessionId,
        totalYield: results.length,
        leads: results,
      });
      return { sessionId, totalYield: results.length, leads: results };
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

server.listen(PORT, () => {
  console.log(`Locus server running on port ${PORT}`);
});
