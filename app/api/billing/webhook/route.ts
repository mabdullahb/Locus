import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expected !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        const notes = payment.notes || {};

        if (notes.userId) {
          const existing = await prisma.payment.findUnique({
            where: { razorpayPaymentId: payment.id },
          });

          if (!existing) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await prisma.payment.create({
              data: {
                userId: notes.userId,
                amount: payment.amount / 100,
                currency: payment.currency || "INR",
                status: "captured",
                razorpayOrderId: payment.order_id,
                razorpayPaymentId: payment.id,
                planType: (notes.planType as string) || "professional",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            });
          }
        }
        break;
      }
      case "payment.failed": {
        const failedPayment = event.payload.payment.entity;
        const existing = await prisma.payment.findUnique({
          where: { razorpayPaymentId: failedPayment.id },
        });
        if (existing) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: { status: "failed" },
          });
        }
        break;
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
