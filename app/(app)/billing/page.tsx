"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    priceLabel: "Free",
    credits: 100,
    features: [
      "100 leads per month",
      "Basic enrichment",
      "CSV export",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: 999,
    priceLabel: "\u20B9 999",
    credits: 5000,
    features: [
      "5,000 leads per month",
      "AI enrichment with email find",
      "CSV, XLSX, JSON export",
      "Advanced filters & sorting",
      "Priority email support",
    ],
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price: 2499,
    priceLabel: "\u20B9 2,499",
    credits: 25000,
    features: [
      "25,000 leads per month",
      "Full AI enrichment pipeline",
      "Multi-provider AI keys",
      "Rerun & history analytics",
      "Priority chat support",
    ],
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 9999,
    priceLabel: "\u20B9 9,999",
    credits: 100000,
    features: [
      "100,000 leads per month",
      "Unlimited enrichment depth",
      "Custom integrations",
      "Dedicated proxy pool",
      "SLA & phone support",
    ],
    popular: false,
  },
];

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const [planType, setPlanType] = useState<string | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [creditsLimit, setCreditsLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  interface RazorpayInstance {
    open(): void;
    on(event: string, handler: () => void): void;
  }

  interface RazorpayConstructor {
    new(options: Record<string, unknown>): RazorpayInstance;
  }

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (res.ok) {
        const data = await res.json();
        setPlanType(data.planType);
        setCreditsRemaining(data.creditsRemaining);
        setCreditsLimit(data.creditsLimit);
      }
    } catch {
      // not authenticated or error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleUpgrade = async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || plan.price === 0) return;

    setProcessing(planId);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Failed to load payment gateway. Please try again.");
        setProcessing(null);
        return;
      }

      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: planId }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || "Failed to create order");
      }

      const order = await orderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "Locus",
        description: `${plan.name} Plan`,
        order_id: order.id,
          handler: async function (response: RazorpayResponse) {
          const verifyRes = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: planId,
            }),
          });

          if (!verifyRes.ok) {
            const err = await verifyRes.json();
            setError(err.error || "Payment verification failed");
          } else {
            await fetchSubscription();
          }
          setProcessing(null);
        },
        modal: {
          ondismiss: () => setProcessing(null),
        },
        prefill: {
          contact: "",
        },
        theme: {
          color: "#b45309",
        },
      };

      const RazorpayCtor = window.Razorpay as RazorpayConstructor;
      const rzp = new RazorpayCtor(options);
      rzp.on("payment.failed", function () {
        setError("Payment failed. Please try again.");
        setProcessing(null);
      });
      rzp.open();
    } catch (err) {
      setError((err as Error).message);
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Plans & Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the plan that fits your needs. {creditsLimit > 0 && `${creditsRemaining} / ${creditsLimit} credits remaining this period.`}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {planType && planType !== "starter" && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-foreground">
            You are currently on the <span className="capitalize">{planType}</span> plan.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = planType === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border bg-card p-6 transition-shadow ${
                plan.popular
                  ? "border-accent shadow-lg shadow-accent/10"
                  : "border-border"
              } ${isCurrent ? "ring-2 ring-primary" : ""}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
                  Most Popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-2 font-display text-3xl font-bold text-foreground">
                  {plan.priceLabel}
                  {plan.price > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.credits.toLocaleString()} credits/month
                </p>
              </div>

              <ul className="mb-6 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || processing !== null}
                className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "border border-border bg-muted text-muted-foreground cursor-default"
                    : plan.popular
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {processing === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : isCurrent ? (
                  "Current Plan"
                ) : plan.price === 0 ? (
                  "Free"
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
