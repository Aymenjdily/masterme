"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folder, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { VERCEL_PLAN_MONTHLY_USD } from "@/lib/hosting";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryItem = { projectId: string; title: string; totalUsd: number; stale?: boolean };

export type AppsSummary = {
  neon: { totalUsd: number; items: SummaryItem[] };
  vercel: { totalUsd: number; items: SummaryItem[] };
  totalUsd: number;
  /** When the newest stored Neon reading was taken (daily job or Recalculate) */
  updatedAt: string | null;
  staleCount: number;
  /** Neon-linked projects with no reading yet */
  pendingCount: number;
};

async function fetchAppsSummary(): Promise<AppsSummary> {
  const res = await fetch("/api/monthly-costs/apps-summary");
  if (!res.ok) throw new Error("Failed to load apps summary");
  return res.json();
}

export function useAppsSummary() {
  return useQuery({
    queryKey: queryKeys.appsSummary,
    queryFn: fetchAppsSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export const usd = (value: number) => `$${value.toFixed(2)}`;

/** "today 05:00", "yesterday 05:00" or "24 Sep 05:00" */
export function updatedLabel(iso: string | null | undefined) {
  if (!iso) return "not calculated yet";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (Date.now() - d.getTime() < 90_000) return "just now";
  if (days === 0) return `today ${time}`;
  if (days === 1) return `yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
}

export type RecalcResult = { updated: number; failed: string[]; at: string };

/** Recalculate button: stores fresh Neon readings for the user's projects, then refreshes the pages. */
export function useRecalculateInfra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RecalcResult> => {
      const res = await fetch("/api/infra/recalculate", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Couldn't recalculate.");
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.appsSummary });
    },
  });
}

export function EstimateTag() {
  return (
    <span className="rounded-[5px] bg-stone/30 px-1.5 py-0.5 font-mono text-[0.625rem] font-medium tracking-wider text-stone-strong uppercase">
      Estimate
    </span>
  );
}

function ServiceGroup({
  name,
  mark,
  markClassName,
  estimate,
  total,
  items,
  emptyText,
  sharedPlan,
}: {
  name: string;
  mark: string;
  markClassName: string;
  estimate?: boolean;
  total: number;
  items: SummaryItem[];
  emptyText: string;
  /** One flat plan covering every listed project: rows show "Included" instead of a price. */
  sharedPlan?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[0.84rem] font-semibold">
          <span className={cn("flex size-7 items-center justify-center rounded-lg text-[0.6875rem] font-bold", markClassName)}>
            {mark}
          </span>
          {name}
          {estimate && <EstimateTag />}
        </div>
        <span className="font-mono text-[0.8125rem] font-medium">{usd(total)}</span>
      </div>
      {sharedPlan && items.length > 0 && (
        <p className="-mt-1 mb-2 text-xs text-muted-foreground">{sharedPlan}</p>
      )}
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-input px-3 py-2.5 text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.projectId}
              className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-[0.84rem]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Folder className="size-3.75 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.title}</span>
              </span>
              {sharedPlan ? (
                <span className="text-xs text-muted-foreground">Included</span>
              ) : (
                <span className="font-mono text-[0.8125rem] font-medium">
                  {usd(item.totalUsd)} <span className="font-normal text-muted-foreground">/ mo</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AppsServicesSummary() {
  const { data, isPending, isError } = useAppsSummary();

  return (
    <Card className="gap-4 rounded-[20px] px-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[0.9375rem] font-semibold">Apps &amp; services</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Computed from your Projects</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-[0.65625rem] font-medium",
            data?.staleCount ? "text-warning-strong" : "text-success-strong"
          )}
          title={data?.staleCount ? `${data.staleCount} project(s) couldn't be updated today` : undefined}
        >
          <span className={cn("size-1.5 rounded-full ring-3", data?.staleCount ? "bg-primary ring-primary/20" : "bg-success ring-success/20")} />
          {data ? `Updated ${updatedLabel(data.updatedAt)}` : "…"}
        </span>
      </div>

      {isPending && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      )}
      {isError && <p className="text-sm text-destructive-strong">Failed to load apps summary.</p>}

      {data && (
        <>
          <ServiceGroup
            name="Neon"
            mark="N"
            markClassName="bg-success/15 text-success-strong"
            estimate
            total={data.neon.totalUsd}
            items={data.neon.items}
            emptyText="No projects linked to a Neon project."
          />
          <ServiceGroup
            name="Vercel"
            mark="▲"
            markClassName="bg-foreground/6 text-foreground"
            total={data.vercel.totalUsd}
            items={data.vercel.items}
            emptyText="No projects marked as hosted on Vercel."
            sharedPlan={`One flat plan · ${usd(VERCEL_PLAN_MONTHLY_USD)} / mo covers ${data.vercel.items.length === 1 ? "this project" : `all ${data.vercel.items.length} projects`}`}
          />
        </>
      )}

      <p className="flex gap-2 rounded-xl bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-px size-3.75 shrink-0" />
        Link a Neon project or tick &ldquo;Hosted on Vercel&rdquo; on a project to count it here. Neon is estimated from
        usage, recalculated every day (or with Recalculate on Projects). Projects with linked costs count those instead.
      </p>
    </Card>
  );
}
