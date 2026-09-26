import {
  Dumbbell,
  Droplet,
  Flame,
  House,
  Music,
  Receipt,
  Shield,
  Smartphone,
  Tv,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { MonthlyCost } from "@/types";

// Icon + palette tint picked from the bill name (English and French keywords).
const BILL_KINDS: { match: RegExp; icon: LucideIcon; tint: string }[] = [
  { match: /rent|loyer|apartment|house/i, icon: House, tint: "bg-primary/18 text-warning-strong" },
  { match: /electric|lydec|power|électricité/i, icon: Zap, tint: "bg-success/15 text-success-strong" },
  { match: /wifi|internet|fibre|fiber|adsl/i, icon: Wifi, tint: "bg-info/12 text-info-strong" },
  { match: /water|eau/i, icon: Droplet, tint: "bg-info/12 text-info-strong" },
  { match: /phone|mobile|forfait|gsm/i, icon: Smartphone, tint: "bg-special/12 text-special-strong" },
  { match: /gas|gaz|butane/i, icon: Flame, tint: "bg-destructive/10 text-destructive-strong" },
  { match: /spotify|music|deezer|anghami/i, icon: Music, tint: "bg-stone/45 text-stone-strong" },
  { match: /netflix|tv|stream|disney|youtube|shahid/i, icon: Tv, tint: "bg-stone/45 text-stone-strong" },
  { match: /gym|fitness|sport/i, icon: Dumbbell, tint: "bg-success/15 text-success-strong" },
  { match: /insurance|assurance/i, icon: Shield, tint: "bg-info/12 text-info-strong" },
];

export function billKind(name: string) {
  return BILL_KINDS.find((kind) => kind.match.test(name)) ?? {
    icon: Receipt,
    tint: "bg-muted text-muted-foreground",
  };
}

export function formatAmount(amount: number) {
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Totals per currency, e.g. [{ currency: "MAD", total: 4090 }]. Never converts. */
export function totalsByCurrency(items: MonthlyCost[]) {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }
  return [...totals.entries()].map(([currency, total]) => ({ currency, total }));
}

export function formatTotals(items: MonthlyCost[]) {
  const totals = totalsByCurrency(items);
  if (totals.length === 0) return null;
  return totals.map((t) => `${formatAmount(t.total)} ${t.currency}`).join(" + ");
}
