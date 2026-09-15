import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { encryptApiKey } from "@/lib/enrichment";
import { getAllProviderValues, getProviderCategory, getProviderLabel, getProviderInfo, getProvidersByCategory } from "@/lib/enrichment";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { parseJsonBody, InvalidJsonError } from "@/lib/parse-json-body";

const VALID_PROVIDERS = getAllProviderValues();

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
      select: { id: true, provider: true, keyPrefix: true, model: true, createdAt: true },
    });

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.id,
        provider: k.provider,
        keyPrefix: k.keyPrefix,
        model: k.model,
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
    const { provider, apiKey, model } = await parseJsonBody<{ provider: string; apiKey: string; model?: string }>(req);

    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 },
      );
    }

    const category = getProviderCategory(provider);
    if (!category) {
      return NextResponse.json({ error: `Unknown provider category for: ${provider}` }, { status: 400 });
    }

    // adminOnly providers (currently just 9Router, still under test) — the
    // client hides the option for non-admins, but that's a UX nicety, not a
    // security boundary. Re-verify isAdmin fresh from the DB here, same as
    // every other admin check in this app.
    if (getProviderInfo(provider)?.adminOnly) {
      const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
      if (!dbUser?.isAdmin) {
        return NextResponse.json(
          { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
          { status: 400 },
        );
      }
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 8) {
      return NextResponse.json(
        { error: "API key must be at least 8 characters" },
        { status: 400 },
      );
    }

    const trimmedModel = typeof model === "string" && model.trim() ? model.trim() : null;
    const encryptedKey = encryptApiKey(apiKey);

    // Only one provider per category can actually be used at a time. The
    // enrichment/search code picks a single key with findFirst({ isActive:
    // true }) and no orderBy, so leaving two keys active in the same
    // category (e.g. trying 9Router, then switching to OpenRouter without
    // removing the old key) makes Postgres's unspecified row order decide
    // which provider actually runs on any given request.
    const otherProvidersInCategory = getProvidersByCategory(category)
      .map((p) => p.value)
      .filter((v) => v !== provider);
    if (otherProvidersInCategory.length > 0) {
      await prisma.userApiKey.updateMany({
        where: { userId, isActive: true, provider: { in: otherProvidersInCategory } },
        data: { isActive: false },
      });
    }

    await prisma.userApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        encryptedKey,
        keyPrefix: apiKey.slice(0, 8),
        model: trimmedModel,
        isActive: true,
      },
      create: {
        userId,
        provider,
        encryptedKey,
        keyPrefix: apiKey.slice(0, 8),
        model: trimmedModel,
      },
    });

    return NextResponse.json({
      provider,
      keyPrefix: apiKey.slice(0, 4) + "****",
      message: `${getProviderLabel(provider)} API key saved successfully`,
    });
  } catch (err) {
    if (err instanceof InvalidJsonError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const message = (err as Error).message || "Failed to save API key";
    return NextResponse.json({ error: message }, { status: 500 });
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
