import { NextRequest, NextResponse } from "next/server";

const mockSessions = [
  { id: "hist-1", query: "Digital Marketing Agencies", location: "Hyderabad, Telangana", status: "completed", yield: { leads: 47, emails: 31, phones: 43, enriched: 28 }, startedAt: Date.now() - 86400000 * 3, completedAt: Date.now() - 86400000 * 3 + 420000, duration: 420, errorLog: null },
  { id: "hist-2", query: "IT Companies", location: "Whitefield, Bangalore", status: "completed", yield: { leads: 83, emails: 52, phones: 76, enriched: 48 }, startedAt: Date.now() - 86400000 * 5, completedAt: Date.now() - 86400000 * 5 + 780000, duration: 780, errorLog: null },
  { id: "hist-3", query: "Real Estate Developers", location: "Pune, Maharashtra", status: "failed", yield: { leads: 12, emails: 3, phones: 10, enriched: 0 }, startedAt: Date.now() - 86400000, completedAt: Date.now() - 86400000 + 120000, duration: 120, errorLog: "CAPTCHA blocked after 12 records. Retry with residential proxies." },
  { id: "hist-4", query: "Co-working Spaces", location: "HITEC City, Hyderabad", status: "completed", yield: { leads: 34, emails: 22, phones: 31, enriched: 20 }, startedAt: Date.now() - 86400000 * 7, completedAt: Date.now() - 86400000 * 7 + 300000, duration: 300, errorLog: null },
  { id: "hist-5", query: "CA Firms", location: "Mumbai, Maharashtra", status: "aborted", yield: { leads: 8, emails: 2, phones: 6, enriched: 1 }, startedAt: Date.now() - 86400000 * 2, completedAt: Date.now() - 86400000 * 2 + 180000, duration: 180, errorLog: "User aborted — quota limit reached." },
  { id: "hist-6", query: "Software Product Companies", location: "Koramangala, Bangalore", status: "completed", yield: { leads: 64, emails: 41, phones: 58, enriched: 38 }, startedAt: Date.now() - 86400000 * 10, completedAt: Date.now() - 86400000 * 10 + 600000, duration: 600, errorLog: null },
  { id: "hist-7", query: "Hospitals & Clinics", location: "Chennai, Tamil Nadu", status: "failed", yield: { leads: 0, emails: 0, phones: 0, enriched: 0 }, startedAt: Date.now() - 86400000 * 4, completedAt: Date.now() - 86400000 * 4 + 30000, duration: 30, errorLog: "All 4 proxies blocked immediately. Switch to residential proxy pool." },
  { id: "hist-8", query: "E-commerce Platforms", location: "Delhi NCR", status: "completed", yield: { leads: 52, emails: 33, phones: 48, enriched: 30 }, startedAt: Date.now() - 86400000 * 6, completedAt: Date.now() - 86400000 * 6 + 540000, duration: 540, errorLog: null },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "25");

  let filtered = [...mockSessions];

  if (status && status !== "all") {
    filtered = filtered.filter((s) => s.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.query.toLowerCase().includes(q) || s.location.toLowerCase().includes(q));
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return NextResponse.json({
    sessions: paged,
    total,
    totalPages,
    currentPage: Math.min(page, totalPages),
    pageSize,
  });
}
