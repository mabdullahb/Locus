import Razorpay from "razorpay";
import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;

export const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

export const PLAN_PRICES: Record<string, { amount: number; credits: number; label: string }> = {
  starter: { amount: 0, credits: 100, label: "Starter" },
  professional: { amount: 99900, credits: 5000, label: "Professional" },
  business: { amount: 249900, credits: 25000, label: "Business" },
  enterprise: { amount: 999900, credits: 100000, label: "Enterprise" },
};

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}
