import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, format } = body;

    if (!sessionId || !format) {
      return NextResponse.json({ error: "sessionId and format required" }, { status: 400 });
    }

    if (!["csv", "xlsx", "json"].includes(format)) {
      return NextResponse.json({ error: "format must be csv, xlsx, or json" }, { status: 400 });
    }

    return NextResponse.json({
      status: "export_queued",
      sessionId,
      format,
      filename: `locus-export-${sessionId}.${format}`,
      downloadUrl: `/api/export/download/${sessionId}?format=${format}`,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
