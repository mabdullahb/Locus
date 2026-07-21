"use client";

interface CreditEstimatorProps {
  maxResults: number;
  enrichmentDepth: string;
  concurrency: number;
}

function calculateCredits(
  maxResults: number,
  enrichmentDepth: string,
  concurrency: number,
): { total: number; perLead: number; cost: string } {
  const baseRates: Record<string, number> = {
    basic: 1,
    standard: 2,
    full: 5,
    deep: 10,
  };
  const perLeadCredits = baseRates[enrichmentDepth] ?? 1;
  const total = maxResults * perLeadCredits;
  const bulkDiscount = concurrency >= 16 ? 0.85 : concurrency >= 8 ? 0.92 : 1;
  const discounted = Math.round(total * bulkDiscount);
  const inrCost = discounted * 2;
  return {
    total: discounted,
    perLead: perLeadCredits,
    cost: `₹${inrCost.toLocaleString("en-IN")}`,
  };
}

export function CreditEstimator({ maxResults, enrichmentDepth, concurrency }: CreditEstimatorProps) {
  const { total, perLead, cost } = calculateCredits(maxResults, enrichmentDepth, concurrency);

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">Estimated cost:</span>
      <span className="font-mono text-base font-semibold text-foreground">{cost}</span>
      <span className="text-xs text-muted-foreground">
        ({total.toLocaleString()} credits @ {perLead}/lead)
      </span>
    </div>
  );
}
