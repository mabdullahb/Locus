import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hybridEnrichLead,
  decryptApiKey,
  getBusinessSearchValues,
  getAIProviderValues,
  sanitizeLog,
  isRateLimitError,
  canDowngradeEnrichmentStatus,
  describeEnrichmentError,
} from "@/lib/enrichment";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

const EMAIL_REGEXP = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Unlike the main extraction pipeline (server/index.ts), this runs
// synchronously inside the Next.js request handler rather than through the
// BullMQ queue. Worst case at MAX_LEADS_PER_REQUEST=100 and
// RETRY_CONCURRENCY=4 (25 batches x ENRICHMENT_TIMEOUT=60s) is ~25 minutes,
// which fits an always-on Node process but will exceed the request timeout
// on most serverless hosts (Vercel's default is well under that). If this
// app is ever deployed somewhere with a hard request timeout, either lower
// MAX_LEADS_PER_REQUEST to fit comfortably under that host's limit, or move
// this route to queue a job the same way the main pipeline does.
//
// Bounds a single retry request so it can't run indefinitely against a huge
// backlog of failed leads, matching the concurrency/timeout shape already
// used for bulk enrichment in server/index.ts. Users with more than this
// many failed leads can just click "Retry" again once the first batch lands.
const MAX_LEADS_PER_REQUEST = 100;
// See server/index.ts for the timing data behind these two values — a
// self-hosted enrichment provider (9Router) measured at 5-13s per LLM call,
// with worst-case chains (website fetch + LLM + search + LLM) hitting ~40s.
const RETRY_CONCURRENCY = 4;
const ENRICHMENT_TIMEOUT = 60000;

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const body = await req.json().catch(() => ({}));
  const scope: "rate_limited" | "all" = body?.scope === "rate_limited" ? "rate_limited" : "all";

  const userApiKey = await prisma.userApiKey.findFirst({
    where: { userId, isActive: true, provider: { in: getAIProviderValues() } },
    orderBy: { createdAt: "desc" },
  });
  if (!userApiKey) {
    return NextResponse.json(
      { error: "No AI provider configured. Add an API key in Settings." },
      { status: 400 },
    );
  }
  const apiKey = decryptApiKey(userApiKey.encryptedKey);

  const extractionKeyRecord = await prisma.userApiKey.findFirst({
    where: { userId, provider: { in: getBusinessSearchValues() }, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  const extractionApiKey = extractionKeyRecord
    ? decryptApiKey(extractionKeyRecord.encryptedKey)
    : undefined;

  const candidates = await prisma.businessLead.findMany({
    // "pending" leads never had an enrichment attempt at all — usually from
    // a session that got aborted before its enrichment loop started. They
    // have the same "needs an attempt" need as a failed lead, just with no
    // error to show, so they ride along in the same retry sweep.
    where: { session: { userId }, status: { in: ["failed", "pending"] } },
    select: {
      id: true,
      businessName: true,
      website: true,
      location: true,
      phone: true,
      emailVerified: true,
      enrichmentLogs: {
        select: { errorMessage: true },
        orderBy: { enrichedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const targets = candidates
    .filter((lead) =>
      scope === "rate_limited" ? isRateLimitError(lead.enrichmentLogs[0]?.errorMessage) : true,
    )
    .slice(0, MAX_LEADS_PER_REQUEST);

  let verified = 0;
  let needsEnrich = 0;
  let stillFailed = 0;

  const retryOne = async (lead: (typeof targets)[number]) => {
    try {
      const result = await Promise.race([
        hybridEnrichLead(
          userId,
          userApiKey.provider as "gemini" | "anthropic" | "openai" | "openrouter" | "9router",
          apiKey,
          lead.businessName,
          lead.website,
          lead.location,
          extractionApiKey,
          userApiKey.model ?? undefined,
          extractionKeyRecord?.provider,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Enrichment timeout")), ENRICHMENT_TIMEOUT),
        ),
      ]);

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
        verified++;
        await prisma.businessLead.update({
          where: { id: lead.id },
          data: {
            email: validEmail,
            phone: result.phone || lead.phone,
            status: "verified",
            emailVerified: true,
          },
        });
      } else {
        // A retry that finds nothing (or a concurrent duplicate attempt
        // that just didn't reproduce an earlier find) shouldn't downgrade a
        // lead that already has a real, previously-confirmed email — that
        // silently hid a correct result behind a status that says "try
        // again" while the email sat right there in the database.
        if (canDowngradeEnrichmentStatus(lead.emailVerified)) {
          needsEnrich++;
          await prisma.businessLead.update({
            where: { id: lead.id },
            data: { status: "needs_enrich" },
          }).catch(() => {});
        }
      }
    } catch (err) {
      const message = sanitizeLog(describeEnrichmentError(err)).slice(0, 500);
      console.error(`Retry enrichment failed for lead ${lead.id} (${lead.businessName}):`, message);
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
      // Same reasoning as the not-found branch above — a concurrent
      // duplicate attempt timing out shouldn't knock an already-verified
      // lead back to "failed".
      if (canDowngradeEnrichmentStatus(lead.emailVerified)) {
        stillFailed++;
        await prisma.businessLead.update({
          where: { id: lead.id },
          data: { status: "failed" },
        }).catch(() => {});
      }
    }
  };

  for (let i = 0; i < targets.length; i += RETRY_CONCURRENCY) {
    const batch = targets.slice(i, i + RETRY_CONCURRENCY);
    await Promise.allSettled(batch.map(retryOne));
  }

  return NextResponse.json({
    attempted: targets.length,
    verified,
    needsEnrich,
    stillFailed,
    remaining: Math.max(0, candidates.length - targets.length),
  });
}
