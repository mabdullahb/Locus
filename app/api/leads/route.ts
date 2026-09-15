import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import type { BusinessLeadWhereInput } from "@/lib/generated/prisma/models";
import { LeadStatus } from "@/lib/generated/prisma/enums";

const LEAD_STATUS_VALUES: readonly string[] = Object.values(LeadStatus);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";
  const sessionId = searchParams.get("sessionId");
  const sortCol = searchParams.get("sort");
  const sortDir = searchParams.get("dir") || "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  // The dashboard's Leads Data Table does one big fetch on load and then
  // filters/sorts/paginates entirely client-side (see dashboard/page.tsx) —
  // it isn't a page-by-page UI. A cap of 100 here silently truncated that
  // fetch, making any lead outside the 100 most recent invisible to search,
  // filter, and bulk actions with no indication anything was cut off. 5000
  // covers realistic single-account volumes for this tool; genuine
  // pagination would be a bigger redesign if usage ever outgrows this.
  const pageSize = Math.min(5000, Math.max(1, parseInt(searchParams.get("pageSize") || "25")));

  try {
    const where: BusinessLeadWhereInput = { session: { userId } };
    if (status !== "all" && LEAD_STATUS_VALUES.includes(status)) {
      where.status = status as LeadStatus;
    }
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: Record<string, string>[] = [];
    if (sortCol && ["businessName", "location", "phone", "email", "status"].includes(sortCol)) {
      orderBy.push({ [sortCol]: sortDir });
    }
    orderBy.push({ createdAt: "desc" });

    const [total, rows] = await Promise.all([
      prisma.businessLead.count({ where }),
      prisma.businessLead.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const leads = rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      businessName: r.businessName,
      location: r.location,
      phone: r.phone || "",
      email: r.email || "",
      status: r.status,
      createdAt: r.createdAt.getTime(),
    }));

    return NextResponse.json({ leads, total, totalPages, currentPage: page, pageSize });
  } catch {
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const { ids } = (await req.json()) as { ids?: string[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Provide at least one lead id" }, { status: 400 });
    }

    // Only delete leads this user actually owns — ids are client-supplied,
    // never trust them without checking session.userId first.
    const owned = await prisma.businessLead.findMany({
      where: { id: { in: ids }, session: { userId } },
      select: { id: true },
    });
    const ownedIds = owned.map((l) => l.id);

    if (ownedIds.length === 0) {
      return NextResponse.json({ error: "No matching leads found" }, { status: 404 });
    }

    // EnrichmentLog.lead has no onDelete: Cascade, so deleting a
    // BusinessLead with existing logs would fail on the FK constraint —
    // clear those first, same pattern as the account-deletion route.
    await prisma.$transaction([
      prisma.enrichmentLog.deleteMany({ where: { leadId: { in: ownedIds } } }),
      prisma.businessLead.deleteMany({ where: { id: { in: ownedIds } } }),
    ]);

    return NextResponse.json({ deleted: ownedIds.length });
  } catch {
    return NextResponse.json({ error: "Failed to delete leads" }, { status: 500 });
  }
}
