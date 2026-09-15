import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hybridEnrichLead, decryptApiKey, getBusinessSearchValues, getAIProviderValues, sanitizeLog, canDowngradeEnrichmentStatus, describeEnrichmentError } from "@/lib/enrichment";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

const EMAIL_REGEXP = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let callerUserId: string;
  try {
    callerUserId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const lead = await prisma.businessLead.findUnique({
      where: { id: id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const session = await prisma.scrapeSession.findUnique({
      where: { id: lead.sessionId },
    });

    if (!session || session.userId !== callerUserId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const userApiKey = await prisma.userApiKey.findFirst({
      where: { userId: session.userId, isActive: true, provider: { in: getAIProviderValues() } },
      // Exactly one of these should ever be active at a time (enforced on
      // save in /api/settings/ai-key). Prefer the most recently saved key
      // over Postgres's unspecified row order if that's ever violated.
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
      where: { userId: session.userId, provider: { in: getBusinessSearchValues() }, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const extractionApiKey = extractionKeyRecord ? decryptApiKey(extractionKeyRecord.encryptedKey) : undefined;

    const result = await hybridEnrichLead(
      session.userId,
      userApiKey.provider as "gemini" | "anthropic" | "openai" | "openrouter" | "9router",
      apiKey,
      lead.businessName,
      lead.website,
      lead.location,
      extractionApiKey,
      userApiKey.model ?? undefined,
      extractionKeyRecord?.provider,
    );

    // LLM-derived value — never trust it's a well-formed email before persisting/marking verified.
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
      await prisma.businessLead.update({
        where: { id: lead.id },
        data: {
          email: validEmail,
          phone: result.phone || lead.phone,
          status: "verified",
          emailVerified: true,
        },
      });
    } else if (canDowngradeEnrichmentStatus(lead.emailVerified)) {
      // Ran cleanly, genuinely found nothing — mark attempted/retryable
      // rather than leaving the lead looking untouched. But if this lead
      // already has a real, previously-confirmed email (e.g. a retry that
      // hit the rate limiter or just didn't reproduce the earlier find),
      // don't downgrade a correct "verified" lead back to "needs_enrich" —
      // that silently hid a real result behind a status that says "try
      // again" while the actual email sat right there in the database.
      await prisma.businessLead.update({
        where: { id: lead.id },
        data: { status: "needs_enrich" },
      }).catch(() => {});
    }

    return NextResponse.json({
      leadId: lead.id,
      status: validEmail ? "verified" : "not_found",
      email: validEmail,
      enrichedAt: new Date().toISOString(),
      sources: [result.source],
    });
  } catch (err) {
    const message = sanitizeLog(describeEnrichmentError(err)).slice(0, 500);
    console.error(`On-demand enrichment failed for lead ${id}:`, message);
    // The lead may not have made it far enough into the try block to be
    // defined (e.g. the DB lookup itself failed) — only log/mark it if we
    // actually have one.
    await prisma.enrichmentLog.create({
      data: {
        leadId: id,
        source: "error",
        resultStatus: "error",
        emailFound: false,
        apiCostCredits: 0,
        errorMessage: message,
      },
    }).catch(() => {});
    // Same reasoning as the not-found branch above — a concurrent duplicate
    // attempt (or this route being hit again after an earlier success)
    // erroring out shouldn't knock an already-verified lead back to
    // "failed" and hide its real, previously-confirmed email behind it.
    const current = await prisma.businessLead.findUnique({
      where: { id: id },
      select: { emailVerified: true },
    }).catch(() => null);
    if (canDowngradeEnrichmentStatus(!!current?.emailVerified)) {
      await prisma.businessLead.update({
        where: { id: id },
        data: { status: "failed" },
      }).catch(() => {});
    }
    return NextResponse.json(
      { error: message || "Enrichment failed" },
      { status: 500 },
    );
  }
}
