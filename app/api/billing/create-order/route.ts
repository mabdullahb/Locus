import { NextRequest, NextResponse } from "next/server";
import { razorpay, PLAN_PRICES } from "@/lib/razorpay";
import { requireUserId, unauthorized } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return unauthorized();
  }

  try {
    const { planType } = (await req.json()) as { planType: string };
    const plan = PLAN_PRICES[planType];

    if (!plan || plan.amount === 0) {
      return NextResponse.json({ error: "Invalid or free plan" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const receipt = `plan_${user.id}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: "INR",
      receipt,
      notes: {
        userId: user.id,
        planType,
      },
    });

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
