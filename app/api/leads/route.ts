import { NextRequest, NextResponse } from "next/server";

const businesses = [
  { businessName: "TechNova Solutions", location: "HITEC City, Hyderabad", phone: "+91 40 4123 4567", email: "info@technova.in" },
  { businessName: "Sahaj Software Services", location: "Koramangala, Bangalore", phone: "+91 80 2345 6789", email: "contact@sahajsoft.com" },
  { businessName: "Greenfield Analytics", location: "Shivaji Nagar, Pune", phone: "+91 20 3456 7890", email: "hello@greenfield.in" },
  { businessName: "MapMyLead Technologies", location: "Banjara Hills, Hyderabad", phone: "+91 40 5678 9012", email: "sales@mapmylead.com" },
  { businessName: "Apex Digital Marketing", location: "Andheri East, Mumbai", phone: "+91 22 6789 0123", email: "info@apexdigital.co" },
  { businessName: "Crimson Consulting Group", location: "Indiranagar, Bangalore", phone: "+91 80 7890 1234", email: "team@crimson.in" },
  { businessName: "DataWeave Labs", location: "Sector 62, Noida", phone: "+91 120 456 7890", email: "hello@dataweave.com" },
  { businessName: "Orbit Research Intl", location: "Viman Nagar, Pune", phone: "+91 20 5678 9012", email: "info@orbitresearch.in" },
  { businessName: "Prism Revenue Systems", location: "Alwarpet, Chennai", phone: "+91 44 3456 7890", email: "sales@prismrevenue.com" },
  { businessName: "Elevate Growth Partners", location: "Salt Lake, Kolkata", phone: "+91 33 4567 8901", email: "hello@elevate.in" },
  { businessName: "NexGen B2B Solutions", location: "MG Road, Bangalore", phone: "+91 80 5678 9012", email: "info@nexgenb2b.com" },
  { businessName: "Stratify Consulting", location: "Jubilee Hills, Hyderabad", phone: "+91 40 6789 0123", email: "contact@stratify.in" },
  { businessName: "VantagePoint Advisory", location: "R A Puram, Chennai", phone: "+91 44 7890 1234", email: "team@vantagepoint.in" },
  { businessName: "CloudPulse Technologies", location: "Whitefield, Bangalore", phone: "+91 80 8901 2345", email: "info@cloudpulse.io" },
  { businessName: "Blue Ocean Research", location: "Koregaon Park, Pune", phone: "+91 20 9012 3456", email: "hello@blueocean.in" },
  { businessName: "IronClad Data Services", location: "Connaught Place, Delhi", phone: "+91 11 2345 6789", email: "info@ironcladdata.com" },
  { businessName: "SilverOak Marketing", location: "Navrangpura, Ahmedabad", phone: "+91 79 3456 7890", email: "contact@silveroak.in" },
  { businessName: "FusionLead Technologies", location: "HSR Layout, Bangalore", phone: "+91 80 4567 8901", email: "hello@fusionlead.com" },
  { businessName: "Pinnacle Growth Labs", location: "Gachibowli, Hyderabad", phone: "+91 40 5678 9012", email: "sales@pinnacle.in" },
  { businessName: "Zenith Market Research", location: "Electronic City, Bangalore", phone: "+91 80 6789 0123", email: "info@zenithmr.in" },
  { businessName: "AccelQuest Solutions", location: "Thane West, Mumbai", phone: "+91 22 7890 1234", email: "team@accelquest.com" },
  { businessName: "BrightPath Media", location: "Sadashiv Nagar, Bangalore", phone: "+91 80 8901 2345", email: "hello@brightpath.in" },
  { businessName: "CatalystIQ Consulting", location: "Nungambakkam, Chennai", phone: "+91 44 9012 3456", email: "info@catalystiq.com" },
  { businessName: "Neuralytics Software", location: "Ameerpet, Hyderabad", phone: "+91 40 1234 5678", email: "contact@neuralytics.in" },
  { businessName: "SkyBridge Advisors", location: "Model Town, Delhi", phone: "+91 11 3456 7890", email: "info@skybridge.in" },
];

const statuses = ["verified", "needs_enrich", "pending", "failed"] as const;
interface LeadData {
  id: string; businessName: string; location: string; phone: string;
  email: string; status: string; createdAt: number; [key: string]: unknown;
}
const leads: LeadData[] = businesses.map((b, i) => ({
  id: `lead-${i + 1}`,
  ...b,
  status: statuses[Math.floor(Math.random() * statuses.length)],
  createdAt: Date.now() - Math.floor(Math.random() * 86400000 * 7),
}));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const sortCol = searchParams.get("sort");
  const sortDir = searchParams.get("dir") || "asc";
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "25");

  let filtered = [...leads];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((l) =>
      l.businessName.toLowerCase().includes(q) ||
      l.location.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.email.toLowerCase().includes(q)
    );
  }
  if (status !== "all") {
    filtered = filtered.filter((l) => l.status === status);
  }
  if (sortCol) {
    filtered.sort((a, b) => {
      const aVal = String(a[sortCol] || "");
      const bVal = String(b[sortCol] || "");
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (Math.min(page, totalPages) - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return NextResponse.json({ leads: paged, total, totalPages, currentPage: Math.min(page, totalPages), pageSize });
}
