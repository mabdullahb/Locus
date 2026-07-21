import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth(handler: (userId: string, req: Request, ...args: any[]) => Promise<Response>) {
  return async (req: Request, ...args: unknown[]) => {
    try {
      const userId = await requireUserId();
      return handler(userId, req, ...args);
    } catch {
      return unauthorized();
    }
  };
}
