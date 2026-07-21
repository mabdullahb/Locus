import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  await new Promise((r) => setTimeout(r, 2000));

  return NextResponse.json({
    leadId: params.id,
    status: "verified",
    enrichedAt: new Date().toISOString(),
    sources: ["website_crawl", "regex_extract"],
  });
}
