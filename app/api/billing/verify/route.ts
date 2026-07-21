import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpaySignature, PLAN_PRICES } from "@/lib/razorpay";
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } =
      (await req.json()) as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        planType: string;
      };

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const plan = PLAN_PRICES[planType];
    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pType = planType as any;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          planType: pType,
          creditsLimit: plan.credits,
          creditsRemaining: { increment: plan.credits },
        },
      });

      const existingSub = await tx.subscription.findUnique({ where: { userId } });
      if (existingSub) {
        await tx.subscription.update({
          where: { userId },
          data: {
            planType: pType,
            status: "active",
            creditsLimit: plan.credits,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId,
            planType: pType,
            status: "active",
            creditsLimit: plan.credits,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await tx.payment.create({
        data: {
          userId,
          amount: plan.amount / 100,
          currency: "INR",
          status: "captured",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          planType: pType,
        },
      });
    });

    return NextResponse.json({
      status: "success",
      planType,
      creditsLimit: plan.credits,
    });
  } catch {
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
