"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JobRadarOverview } from "@/types";
import { Activity, CheckCircle2, XCircle, CircleDashed, CircleAlert } from "lucide-react";

const RUN_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  failed: XCircle,
  skipped: CircleDashed,
  running: CircleAlert,
};

export function JobRadarUsage({ overview }: { overview: JobRadarOverview }) {
  const { spend, quota, runs, config } = overview;
  const spendPct =
    spend.budgetLimitUsd > 0
      ? Math.min(100, Math.round((spend.monthUsd / spend.budgetLimitUsd) * 100))
      : 0;

  return (
    <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <Card className="gap-3 rounded-[20px] p-4.5">
        <h3 className="text-[0.9375rem] font-medium">Apify spend — this month</h3>
        <p className="font-mono text-[1.625rem] font-medium">
          ${spend.monthUsd.toFixed(2)}
          <span className="ml-2 font-sans text-[0.8125rem] font-normal text-muted-foreground">
            cap ${spend.budgetLimitUsd.toFixed(2)} (of ${spend.budgetUsd.toFixed(2)} budget,{" "}
            {config.budgetMarginPct}% margin)
          </span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              spendPct >= 90 ? "bg-destructive" : spendPct >= 60 ? "bg-warning-strong" : "bg-success"
            )}
            style={{ width: `${spendPct}%` }}
          />
        </div>
        <ul className="space-y-1 text-[0.8125rem] text-muted-foreground">
          {spend.byCountry.map((row) => (
            <li key={row.country} className="flex justify-between">
              <span className="capitalize">{countryTitle(row.country)}</span>
              <span className="font-mono">
                {row.results} results · {row.newJobs} new · ${row.usd.toFixed(2)}
                {row.usd > 0 ? "" : " (est.)"}
              </span>
            </li>
          ))}
          {spend.byCountry.length === 0 && <li>No usage recorded this month yet.</li>}
        </ul>
        <p className="text-xs text-muted-foreground">
          Apify pay-per-event: ~$1 per 1,000 results. Costs are shown as estimates when
          Apify does not report the run cost.
        </p>
      </Card>

      <Card className="gap-3 rounded-[20px] p-4.5">
        <h3 className="text-[0.9375rem] font-medium">Daily quotas — today</h3>
        <QuotaBar
          label="Morocco"
          used={quota.morocco.used}
          limit={quota.morocco.limit}
        />
        <QuotaBar label="France" used={quota.france.used} limit={quota.france.limit} />
        <p className="text-xs text-muted-foreground">
          Quota day boundary is in {config.timezone}. Collection stops early the moment a
          quota is reached.
        </p>
      </Card>

      <Card className="gap-0 rounded-[20px] p-4.5 lg:col-span-2">
        <h3 className="flex items-center gap-1.5 text-[0.9375rem] font-medium">
          <Activity className="size-4" />
          Recent collection runs
        </h3>
        {runs.length === 0 ? (
          <p className="py-6 text-center text-[0.8125rem] text-muted-foreground">
            No runs yet. Trigger one with `npm run jobradar:collect` or wait for the schedule.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {runs.map((run) => {
              const Icon = RUN_ICONS[run.status] ?? CircleDashed;
              return (
                <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 text-[0.8125rem]">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium capitalize",
                      run.status === "success" && "text-success-strong",
                      run.status === "failed" && "text-destructive-strong",
                      run.status === "skipped" && "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3.75" />
                    {run.status}
                  </span>
                  <span className="text-muted-foreground">{run.trigger}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatWhen(run.startedAt)}
                  </span>
                  <span className="font-mono">
                    {run.resultsRetrieved} retrieved · {run.newJobs} new
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {run.apifyUsd !== null ? `$${run.apifyUsd.toFixed(2)}` : "cost unknown"}
                  </span>
                  {run.note && (
                    <span className="w-full truncate text-xs text-muted-foreground" title={run.note}>
                      {run.note}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return (
    <div>
      <div className="flex justify-between text-[0.8125rem]">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">
          {used}/{limit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-warning-strong" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function countryTitle(country: string): string {
  return country === "morocco" ? "Morocco" : country === "france" ? "France" : country;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}
