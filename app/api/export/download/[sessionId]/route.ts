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

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | null)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = params;
    const { searchParams } = new URL(req.url);
    const format = parseExportFormat(searchParams.get("format") ?? "csv");

    if (!format) {
      return NextResponse.json({ error: "format must be csv, xlsx, or json" }, { status: 400 });
    }

    const scrapeSession = await prisma.scrapeSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!scrapeSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const leads = await prisma.businessLead.findMany({
      where: { sessionId },
    });

    const data = leads.map((l) => ({
      businessName: l.businessName,
      location: l.location,
      phone: l.phone ?? "",
      email: l.email ?? "",
      website: l.website ?? "",
      category: l.category ?? "",
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }));

    const result = generateExport({
      format,
      columns: EXPORT_COLUMNS,
      data,
      filename: `locus-export-${sessionId}`,
    });

    await prisma.exportHistory.create({
      data: {
        userId,
        sessionId,
        format,
        fileSize: result.size,
      },
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
    console.error("Download export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
