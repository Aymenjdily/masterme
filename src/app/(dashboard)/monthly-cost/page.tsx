import type { Metadata } from "next";
import { MonthlyCostView } from "@/components/monthly-cost/MonthlyCostView";

export const metadata: Metadata = { title: "Monthly cost" };

export default function MonthlyCostPage() {
  return <MonthlyCostView />;
}
