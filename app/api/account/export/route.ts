import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { buildAccountDataXlsx } from "@/lib/export/account-data-xlsx";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "json";

  const [user, scrapeSessions, apiKeys, exportHistory, webhookConfig, connectorConfigs] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          notifyExtractionComplete: true,
          notifyEnrichmentComplete: true,
          notifyWeeklySummary: true,
        },
      }),
      prisma.scrapeSession.findMany({
        where: { userId },
        include: {
          businessLeads: { include: { enrichmentLogs: true } },
          proxySessions: true,
        },
        orderBy: { startedAt: "desc" },
      }),
      // Metadata only, never the encrypted key blob or a decrypted key.
      prisma.userApiKey.findMany({
        where: { userId },
        select: { id: true, provider: true, keyPrefix: true, model: true, isActive: true, createdAt: true },
      }),
      prisma.exportHistory.findMany({ where: { userId } }),
      prisma.webhookConfig.findUnique({ where: { userId }, select: { webhookUrl: true, isActive: true, createdAt: true } }),
      prisma.connectorConfig.findMany({
        where: { userId },
        select: { connectorId: true, config: true, isActive: true, createdAt: true },
      }),
    ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (format === "xlsx") {
    const xlsxBytes = buildAccountDataXlsx({
      account: user,
      scrapeSessions,
      apiKeys,
      exportHistory,
      webhookConfig,
      connectorConfigs,
    });

    return new NextResponse(Buffer.from(xlsxBytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="locus-data-export-${userId}.xlsx"`,
      },
    });
  }

  const exportBundle = {
    exportedAt: new Date().toISOString(),
    account: user,
    scrapeSessions,
    apiKeys,
    exportHistory,
    webhookConfig,
    connectorConfigs,
  };

  return new NextResponse(JSON.stringify(exportBundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="locus-data-export-${userId}.json"`,
    },
  });
}
