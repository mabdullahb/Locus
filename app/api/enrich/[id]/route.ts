import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hybridEnrichLead, decryptApiKey } from "@/lib/enrichment";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const lead = await prisma.businessLead.findUnique({
      where: { id: params.id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const session = await prisma.scrapeSession.findUnique({
      where: { id: lead.sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const userApiKey = await prisma.userApiKey.findFirst({
      where: { userId: session.userId, isActive: true },
    });

    if (!userApiKey) {
      return NextResponse.json(
        { error: "No AI provider configured. Add an API key in Settings." },
        { status: 400 },
      );
    }

    const apiKey = decryptApiKey(userApiKey.encryptedKey);

    const result = await hybridEnrichLead(
      session.userId,
      userApiKey.provider as "gemini" | "anthropic" | "openai",
      apiKey,
      lead.businessName,
      lead.website,
      lead.location,
    );

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

    return NextResponse.json({
      leadId: lead.id,
      status: result.email ? "verified" : "not_found",
      email: result.email,
      enrichedAt: new Date().toISOString(),
      sources: [result.source],
    });
  } catch {
    return NextResponse.json(
      { error: "Enrichment failed" },
      { status: 500 },
    );
  }
}
