import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Deliberately excluded from proxy.ts's matcher. It's the thing proxy.ts
// calls out to for the DB-backed revocation check, so gating it the same way
// would recurse.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
