import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectorRegistry } from "@/lib/export/connectors/registry";

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | null)?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [webhookConfig, connectorConfigs] = await Promise.all([
    prisma.webhookConfig.findUnique({ where: { userId } }),
    prisma.connectorConfig.findMany({ where: { userId } }),
  ]);

  const definitions = connectorRegistry.getAll();

  return NextResponse.json({
    webhook: webhookConfig ?? null,
    connectors: connectorConfigs.map((c) => ({
      id: c.id,
      connectorId: c.connectorId,
      isActive: c.isActive,
      config: c.config as Record<string, string>,
      createdAt: c.createdAt,
    })),
    definitions,
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, connectorId, config } = body;

    if (type === "webhook") {
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl || typeof webhookUrl !== "string") {
        return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 });
      }

      try {
        new URL(webhookUrl);
      } catch {
        return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
      }

      const webhook = await prisma.webhookConfig.upsert({
        where: { userId },
        update: {
          webhookUrl,
          secret: config?.secret || null,
          isActive: true,
        },
        create: {
          userId,
          webhookUrl,
          secret: config?.secret || null,
        },
      });

      return NextResponse.json({ webhook });
    }

    if (type === "connector") {
      if (!connectorId || typeof connectorId !== "string") {
        return NextResponse.json({ error: "connectorId is required" }, { status: 400 });
      }

      const connector = connectorRegistry.get(connectorId);
      if (!connector) {
        return NextResponse.json({ error: `Unknown connector: ${connectorId}` }, { status: 400 });
      }

      if (!connector.definition.isBuiltIn) {
        return NextResponse.json({ error: `${connector.definition.name} is not yet available` }, { status: 400 });
      }

      const validationError = connector.validate(config ?? {});
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const saved = await prisma.connectorConfig.upsert({
        where: {
          userId_connectorId: { userId, connectorId },
        },
        update: {
          config: config ?? {},
          isActive: true,
        },
        create: {
          userId,
          connectorId,
          config: config ?? {},
        },
      });

      return NextResponse.json({
        connector: {
          id: saved.id,
          connectorId: saved.connectorId,
          isActive: saved.isActive,
          config: saved.config as Record<string, string>,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type. Use 'webhook' or 'connector'" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const connectorId = searchParams.get("connectorId");

  try {
    if (type === "webhook") {
      await prisma.webhookConfig.delete({ where: { userId } });
      return NextResponse.json({ success: true });
    }

    if (type === "connector" && connectorId) {
      await prisma.connectorConfig.delete({
        where: { userId_connectorId: { userId, connectorId } },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type or missing connectorId" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
