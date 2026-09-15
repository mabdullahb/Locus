import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { getBusinessSearchValues, getProviderLabel } from "@/lib/enrichment";
import { internalSecretHeaders } from "@/lib/internal-auth";

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const { query, location, radius, concurrency, enrichmentDepth, locale } = body;

    if (!query || !location) {
      return NextResponse.json({ error: "query and location are required" }, { status: 400 });
    }

    const searchKey = await prisma.userApiKey.findFirst({
      where: { userId, provider: { in: getBusinessSearchValues() }, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    if (!searchKey) {
      const providers = getBusinessSearchValues().map((v) => getProviderLabel(v)).join(" or ");
      return NextResponse.json(
        { error: `Add a ${providers} key in Settings > API Keys before running an extraction.` },
        { status: 400 },
      );
    }

    const sessionId = uuidv4();

    try {
      const expressRes = await fetch(`${SERVER_URL}/api/scrape/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalSecretHeaders() },
        body: JSON.stringify({
          sessionId,
          userId,
          query,
          location,
          searchProvider: searchKey.provider,
          radius: radius || "25",
          concurrency: concurrency || 8,
          proxyType: "residential",
          enrichmentDepth: enrichmentDepth || "standard",
          locale: locale || "en-US",
        }),
      });

      if (!expressRes.ok) {
        return NextResponse.json(
          { error: "Extraction service unavailable — please try again later." },
          { status: 503 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Extraction service unavailable — please try again later." },
        { status: 503 },
      );
    }

    return NextResponse.json({ sessionId, status: "queued" });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
