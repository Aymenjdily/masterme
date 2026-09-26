import { formatAmount } from "@/components/monthly-cost/cost-utils";

type Money = { amount: number; currency: string };

/** Sum per currency, e.g. "35,000 MAD" or "3,000 MAD + 200 USD". Never converts. */
export function formatMoney(items: Money[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  if (totals.size === 0) return null;
  return [...totals.entries()].map(([currency, total]) => `${formatAmount(total)} ${currency}`).join(" + ");
}
