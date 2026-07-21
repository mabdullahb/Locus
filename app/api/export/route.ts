import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateExport, parseExportFormat } from "@/lib/export/export-engine";

const EXPORT_COLUMNS = [
  { key: "businessName", label: "Business Name" },
  { key: "location", label: "Location" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | null)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, format, leadIds, columns, data: inlineData } = body;

    const exportFormat = parseExportFormat(format ?? "csv");
    if (!exportFormat) {
      return NextResponse.json({ error: "format must be csv, xlsx, or json" }, { status: 400 });
    }

    const selectedColumns = columns && Array.isArray(columns) && columns.length > 0
      ? columns
      : EXPORT_COLUMNS;

    let leads: Record<string, unknown>[];
    let filename: string;

    if (inlineData && Array.isArray(inlineData) && inlineData.length > 0) {
      leads = inlineData;
      filename = `locus-export-${Date.now()}`;
    } else if (sessionId && sessionId !== "live") {
      const scrapeSession = await prisma.scrapeSession.findFirst({
        where: { id: sessionId, userId },
      });
      if (!scrapeSession) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      const where: Record<string, unknown> = { sessionId };
      if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        where.id = { in: leadIds };
      }

      const businessLeads = await prisma.businessLead.findMany({ where });
      leads = businessLeads.map((l) => ({
        businessName: l.businessName,
        location: l.location,
        phone: l.phone ?? "",
        email: l.email ?? "",
        website: l.website ?? "",
        category: l.category ?? "",
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      }));
      filename = `locus-export-${sessionId}`;

      await prisma.exportHistory.create({
        data: {
          userId,
          sessionId,
          format: exportFormat,
          fileSize: 0,
        },
      });
    } else {
      return NextResponse.json({ error: "Provide data or a valid sessionId" }, { status: 400 });
    }

    const result = generateExport({
      format: exportFormat,
      columns: selectedColumns,
      data: leads,
      filename,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.size),
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
