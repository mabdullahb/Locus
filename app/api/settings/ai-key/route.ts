import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptApiKey, getAvailableProviders } from "@/lib/enrichment";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";

const VALID_PROVIDERS = getAvailableProviders();

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const keys = await prisma.userApiKey.findMany({
      where: { userId, isActive: true },
      select: { id: true, provider: true, keyPrefix: true, createdAt: true },
    });

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        provider: k.provider,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const { provider, apiKey } = await req.json() as { provider: string; apiKey: string };

    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 8) {
      return NextResponse.json(
        { error: "API key must be at least 8 characters" },
        { status: 400 },
      );
    }

    const encryptedKey = encryptApiKey(apiKey);

    await prisma.userApiKey.upsert({
      where: { id: `${userId}-${provider}` },
      update: {
        encryptedKey,
        keyPrefix: apiKey.slice(0, 8),
        isActive: true,
      },
      create: {
        id: `${userId}-${provider}`,
        userId,
        provider,
        encryptedKey,
        keyPrefix: apiKey.slice(0, 8),
      },
    });

    return NextResponse.json({
      provider,
      keyPrefix: apiKey.slice(0, 4) + "****",
      message: "API key saved successfully",
    });
  } catch {
    return NextResponse.json({ error: "Failed to save API key" }, { status: 500 });
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
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json({ error: "provider query param required" }, { status: 400 });
    }

    await prisma.userApiKey.updateMany({
      where: { userId, provider },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "API key removed" });
  } catch {
    return NextResponse.json({ error: "Failed to remove API key" }, { status: 500 });
  }
}
