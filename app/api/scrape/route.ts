import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

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
    const { query, location, radius, concurrency, proxyType, enrichmentDepth, maxResults } = body;

    if (!query || !location) {
      return NextResponse.json({ error: "query and location are required" }, { status: 400 });
    }

    const sessionId = uuidv4();

    try {
      await fetch(`${SERVER_URL}/api/scrape/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId,
          query,
          location,
          radius: radius || "25",
          concurrency: concurrency || 8,
          proxyType: proxyType || "residential",
          enrichmentDepth: enrichmentDepth || "standard",
          maxResults: maxResults || 100,
        }),
      });
    } catch {
      // Express server not running — use simulation fallback
    }

    return NextResponse.json({ sessionId, status: "queued" });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
