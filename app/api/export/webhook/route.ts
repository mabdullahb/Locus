import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deliverToConnector } from "@/lib/export/webhook";

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
    const { sessionId, leadIds, connectorId, data: inlineData } = body;

    let data: Record<string, unknown>[];

    if (inlineData && Array.isArray(inlineData) && inlineData.length > 0) {
      data = inlineData;
    } else if (sessionId) {
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
      data = businessLeads.map((l) => ({
        businessName: l.businessName,
        location: l.location,
        phone: l.phone ?? "",
        email: l.email ?? "",
        website: l.website ?? "",
        category: l.category ?? "",
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      }));
    } else {
      return NextResponse.json({ error: "Provide data or a sessionId" }, { status: 400 });
    }

    const targetConnectorId = connectorId || "webhook";

    let connectorConfig: Record<string, string> = {};

    if (targetConnectorId === "webhook") {
      const webhookConfig = await prisma.webhookConfig.findUnique({ where: { userId } });
      if (!webhookConfig || !webhookConfig.isActive) {
        return NextResponse.json({
          success: false,
          message: "No active webhook configured",
          error: "Configure a webhook URL in Settings > Integrations first.",
        });
      }
      connectorConfig = {
        webhookUrl: webhookConfig.webhookUrl,
        secret: webhookConfig.secret ?? "",
      };
    } else {
      const savedConfig = await prisma.connectorConfig.findUnique({
        where: { userId_connectorId: { userId, connectorId: targetConnectorId } },
      });
      if (!savedConfig || !savedConfig.isActive) {
        return NextResponse.json({
          success: false,
          message: `No active configuration for "${targetConnectorId}"`,
          error: "Configure this connector in Settings > Integrations first.",
        });
      }
      connectorConfig = savedConfig.config as Record<string, string>;
    }

    const result = await deliverToConnector(targetConnectorId, connectorConfig, {
      sessionId,
      leads: data,
      columns: EXPORT_COLUMNS,
      format: "json",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Webhook delivery error:", err);
    return NextResponse.json({ error: "Webhook delivery failed" }, { status: 500 });
  }
}
