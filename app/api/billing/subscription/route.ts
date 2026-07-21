import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { PLAN_PRICES } from "@/lib/razorpay";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        planType: true,
        creditsRemaining: true,
        creditsLimit: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const planInfo = PLAN_PRICES[user.planType];

    return NextResponse.json({
      planType: user.planType,
      planLabel: planInfo?.label || user.planType,
      creditsRemaining: user.creditsRemaining,
      creditsLimit: user.creditsLimit,
      subscription: sub,
      recentPayments: payments,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}
