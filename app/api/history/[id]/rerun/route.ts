import { NextResponse } from "next/server";

interface RerunData {
  query: string; location: string; config: Record<string, unknown>;
}

const sessions: Record<string, RerunData> = {
  "hist-1": { query: "Digital Marketing Agencies", location: "Hyderabad, Telangana", config: { keyword: "Digital Marketing Agencies", location: "Hyderabad, Telangana", radius: "25", concurrency: 8, proxyType: "residential", enrichmentDepth: "standard", maxResults: 100 } },
  "hist-2": { query: "IT Companies", location: "Whitefield, Bangalore", config: { keyword: "IT Companies", location: "Whitefield, Bangalore", radius: "10", concurrency: 16, proxyType: "residential", enrichmentDepth: "deep", maxResults: 200 } },
  "hist-3": { query: "Real Estate Developers", location: "Pune, Maharashtra", config: { keyword: "Real Estate Developers", location: "Pune, Maharashtra", radius: "50", concurrency: 4, proxyType: "datacenter", enrichmentDepth: "standard", maxResults: 150 } },
  "hist-4": { query: "Co-working Spaces", location: "HITEC City, Hyderabad", config: { keyword: "Co-working Spaces", location: "HITEC City, Hyderabad", radius: "5", concurrency: 4, proxyType: "datacenter", enrichmentDepth: "basic", maxResults: 50 } },
  "hist-5": { query: "CA Firms", location: "Mumbai, Maharashtra", config: { keyword: "CA Firms", location: "Mumbai, Maharashtra", radius: "25", concurrency: 8, proxyType: "residential", enrichmentDepth: "standard", maxResults: 100 } },
  "hist-6": { query: "Software Product Companies", location: "Koramangala, Bangalore", config: { keyword: "Software Product Companies", location: "Koramangala, Bangalore", radius: "10", concurrency: 8, proxyType: "residential", enrichmentDepth: "deep", maxResults: 150 } },
  "hist-7": { query: "Hospitals & Clinics", location: "Chennai, Tamil Nadu", config: { keyword: "Hospitals & Clinics", location: "Chennai, Tamil Nadu", radius: "25", concurrency: 4, proxyType: "datacenter", enrichmentDepth: "standard", maxResults: 100 } },
  "hist-8": { query: "E-commerce Platforms", location: "Delhi NCR", config: { keyword: "E-commerce Platforms", location: "Delhi NCR", radius: "50", concurrency: 16, proxyType: "residential", enrichmentDepth: "standard", maxResults: 200 } },
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = sessions[params.id];
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: "rerun_queued",
    config: session.config,
  });
}
