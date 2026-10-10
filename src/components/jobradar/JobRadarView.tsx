"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Filter,
  Globe,
  Radar as RadarIcon,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { JobOffer, JobRadarOverview } from "@/types";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-patterns/dialogs";
import { showToast } from "@/components/ai/Toast";
import {
  RadarJobCard,
  RadarJobReasonList,
  RadarTagList,
} from "@/components/jobradar/RadarJobCard";
import { JobRadarUsage } from "@/components/jobradar/JobRadarUsage";
import { JobRadarSettings } from "@/components/jobradar/JobRadarSettings";
import {
  APPLIED_SIDE,
  countryLabel,
  filterRadarJobs,
  postedLabel,
  RADAR_STATUSES,
  scoreMeta,
  sortRadarJobs,
  workplaceLabel,
  type FeedFilters,
  type RadarStatus,
} from "@/components/jobradar/radar-utils";

type Tab = "feed" | "usage" | "settings";

const DEFAULT_FILTERS: FeedFilters = {
  country: "all",
  workplace: "all",
  status: "all",
  applied: "all",
  minScore: 0,
  search: "",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return res.json();
}

async function send<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json() as Promise<T>;
}

export function JobRadarView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("feed");
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [detail, setDetail] = useState<JobOffer | null>(null);

  const overviewQuery = useQuery({
    queryKey: queryKeys.jobRadarOverview,
    queryFn: () => getJson<JobRadarOverview>("/api/jobradar/overview"),
  });

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobOffers("radar"),
    queryFn: () => getJson<JobOffer[]>("/api/jobs"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RadarStatus }) =>
      send(`/api/jobs/${id}`, "PATCH", { status }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers("radar") });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobRadarOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
    },
    onError: () => {
      showToast({ title: "Could not update status", detail: "Try again." });
    },
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      // Pulse loop: every POST processes searches that fit in ~3 min of
      // server time; it keeps going until the queue for today is empty.
      type Pulse = {
        processed: number;
        remainingSearches: number;
        resultsRetrieved: number;
        newJobs: number;
        status: string;
        note: string | null;
      };
      let last: Pulse | null = null;
      for (let i = 0; i < 60; i += 1) {
        last = await send<Pulse>("/api/jobradar/collect-now", "POST");
        queryClient.invalidateQueries({ queryKey: queryKeys.jobOffers("radar") });
        queryClient.invalidateQueries({ queryKey: queryKeys.jobRadarOverview });
        if (last.status === "skipped") {
          throw new Error(last.note ?? "collection skipped");
        }
        if (last.remainingSearches === 0) break;
      }
      return last;
    },
    onSuccess: (data) => {
      showToast({
        title: "Jobs refreshed",
        detail: `${data?.newJobs ?? 0} new listings found${data?.newJobs ? " (fresh scoring included)" : ""}`,
      });
    },
    onError: (err) => {
      showToast({
        title: "Collection stopped",
        detail: err instanceof Error ? err.message : "Try again in a minute.",
      });
    },
  });

  const radarJobs = useMemo(
    () => (jobsQuery.data ?? []).filter((j) => j.source === "linkedin-apify"),
    [jobsQuery.data]
  );
  const visible = useMemo(
    () => sortRadarJobs(filterRadarJobs(radarJobs, filters)),
    [radarJobs, filters]
  );

  const loading = overviewQuery.isPending || jobsQuery.isPending;
  const overview = overviewQuery.data;
  const setFilter = <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Job Radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LinkedIn offers from Morocco, France, Saudi Arabia and the UK, scored
            against your profile.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {overview && <PillRow overview={overview} />}
          <Button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            className="cursor-pointer"
          >
            <RadarIcon />
            {collectMutation.isPending ? "Fetching…" : "Get current jobs"}
          </Button>
        </div>
      </div>

      <div className="mt-5.5 grid grid-cols-2 gap-3.5 lg:grid-cols-6">
        <StatCard
          label="Discovered today"
          dot="bg-primary"
          value={overview?.stats.discoveredToday ?? 0}
          sub="new listings stored today"
          highlight={(overview?.stats.discoveredToday ?? 0) > 0}
        />
        <StatCard
          label="Morocco"
          dot="bg-special"
          value={overview?.stats.moroccoJobs ?? 0}
          sub={
            overview
              ? `${overview.quota.morocco.used}/${overview.quota.morocco.limit} quota today`
              : ""
          }
        />
        <StatCard
          label="France"
          dot="bg-info"
          value={overview?.stats.franceJobs ?? 0}
          sub={
            overview
              ? `${overview.quota.france.used}/${overview.quota.france.limit} quota today`
              : ""
          }
        />
        <StatCard
          label="Saudi Arabia"
          dot="bg-warning-strong"
          value={overview?.stats.saudiJobs ?? 0}
          sub={
            overview
              ? `${overview.quota.saudi.used}/${overview.quota.saudi.limit} quota today`
              : ""
          }
        />
        <StatCard
          label="UK"
          dot="bg-primary"
          value={overview?.stats.ukJobs ?? 0}
          sub={
            overview
              ? `${overview.quota.uk.used}/${overview.quota.uk.limit} quota today`
              : ""
          }
        />
        <StatCard
          label="High matches"
          dot="bg-success"
          value={overview?.stats.highScore ?? 0}
          sub="score 80 or above"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="feed" className="cursor-pointer">
              Feed
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {overview?.stats.newJobs ?? radarJobs.filter((j) => j.status === "new").length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="usage" className="cursor-pointer">
              Usage &amp; runs
            </TabsTrigger>
            <TabsTrigger value="settings" className="cursor-pointer">
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {overview && (
          <p className="text-[0.8125rem] text-muted-foreground">
            {overview.spend.monthUsd === 0
              ? "Apify spend this month: unknown — est. $0"
              : `Apify spend this month: $${overview.spend.monthUsd.toFixed(2)} of $${overview.spend.budgetLimitUsd.toFixed(2)} cap`}
          </p>
        )}
      </div>

      {loading && <Skeleton className="mt-3.5 h-72 rounded-[20px]" />}
      {overviewQuery.isError && (
        <p className="mt-3.5 text-sm text-destructive-strong">Failed to load the radar overview.</p>
      )}

      {tab === "feed" && !loading && (
        <>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
              <Filter className="size-3.5" />
            </span>
            <select
              aria-label="Country"
              value={filters.country}
              onChange={(e) => setFilter("country", e.target.value as FeedFilters["country"])}
              className="h-8.5 cursor-pointer rounded-lg border border-input bg-card px-2 text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <option value="all">All countries</option>
              <option value="morocco">Morocco</option>
              <option value="france">France</option>
              <option value="saudi_arabia">Saudi Arabia</option>
              <option value="uk">United Kingdom</option>
            </select>
            <select
              aria-label="Workplace"
              value={filters.workplace}
              onChange={(e) => setFilter("workplace", e.target.value as FeedFilters["workplace"])}
              className="h-8.5 cursor-pointer rounded-lg border border-input bg-card px-2 text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <option value="all">Any workplace</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
            <select
              aria-label="Minimum score"
              value={filters.minScore}
              onChange={(e) => setFilter("minScore", Number(e.target.value))}
              className="h-8.5 cursor-pointer rounded-lg border border-input bg-card px-2 text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <option value={0}>Any score</option>
              <option value={40}>40+</option>
              <option value={60}>60+</option>
              <option value={80}>80+</option>
            </select>
            <select
              aria-label="Status"
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value as FeedFilters["status"])}
              className="h-8.5 cursor-pointer rounded-lg border border-input bg-card px-2 text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <option value="all">Any status</option>
              {RADAR_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                placeholder="Title, company, tech…"
                className="h-8.5 w-48 pl-7.5 text-[0.8125rem]"
              />
            </div>
            {(filters.country !== "all" ||
              filters.workplace !== "all" ||
              filters.status !== "all" ||
              filters.applied !== "all" ||
              filters.minScore > 0 ||
              filters.search !== "") && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset
              </Button>
            )}
          </div>

          <div role="radiogroup" aria-label="Application state" className="mt-2 flex gap-1.5">
            {(
              [
                ["all", "All", radarJobs.length],
                [
                  "not_applied",
                  "Not applied",
                  radarJobs.filter(
                    (j) =>
                      !(
                        APPLIED_SIDE.has(j.status) ||
                        j.status === "archived" ||
                        j.status === "not_interested"
                      )
                  ).length,
                ],
                [
                  "applied",
                  "Applied",
                  radarJobs.filter((j) => APPLIED_SIDE.has(j.status)).length,
                ],
                [
                  "not_interested",
                  "I don't like",
                  radarJobs.filter((j) => j.status === "not_interested").length,
                ],
              ] as [FeedFilters["applied"], string, number][]
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filters.applied === value}
                onClick={() => setFilter("applied", value)}
                className={cn(
                  "h-7.5 cursor-pointer rounded-full border border-input bg-card px-3 text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
                  filters.applied === value && "border-foreground font-medium text-foreground"
                )}
              >
                {label}
                <span className="ml-1.5 font-mono text-[0.6875rem] font-normal text-muted-foreground">
                  {count}
                </span>
              </button>
            ))}
          </div>

          <Card className="mt-3.5 gap-0 rounded-[20px] px-0 py-1.5 [--card-spacing:0]">
            {radarJobs.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  icon={RadarIcon}
                  title="No radar jobs yet"
                  description="The collector runs every 6 hours and stores scored offers here."
                  actionLabel="Check usage"
                  onAction={() => setTab("usage")}
                />
                <p className="-mt-3 flex items-center justify-center gap-1 pb-4 text-[0.8125rem] text-muted-foreground">
                  <Activity className="size-3.5" />
                  First run happens automatically once APIFY_TOKEN is set.
                </p>
              </div>
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
                No jobs match these filters.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((job) => (
                  <RadarJobCard
                    key={job.id}
                    job={job}
                    busy={statusMutation.isPending}
                    onStatus={(status) => statusMutation.mutate({ id: job.id, status })}
                    onOpen={() => setDetail(job)}
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === "usage" && !loading && overview && <JobRadarUsage overview={overview} />}
      {tab === "settings" && !loading && overview && <JobRadarSettings overview={overview} />}

      <JobDetailDialog job={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function JobDetailDialog({ job, onClose }: { job: JobOffer | null; onClose: () => void }) {
  if (!job) return null;
  const matched = job.technologiesMatched ?? [];
  const allMatchable = [...new Set([...matched, ...(job.technologiesMissing ?? [])])];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {job.company}
              </span>
              <span>
                {countryLabel(job.country)}
                {job.location ? ` · ${job.location}` : ""}
              </span>
              <span>{workplaceLabel(job.workplaceType)}</span>
              <span>{postedLabel(job.postedDate)}</span>
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{job.title}</h2>
          </div>
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-full font-mono text-lg font-semibold",
                (job.matchScore ?? 0) >= 80
                  ? "bg-success text-black"
                  : (job.matchScore ?? 0) >= 60
                    ? "bg-special text-white"
                    : (job.matchScore ?? 0) >= 40
                      ? "bg-warning-strong text-white"
                      : "bg-muted-foreground text-white"
              )}
            >
              {job.matchScore ?? "?"}
            </span>
            <span className="mt-1 text-[0.6875rem] text-muted-foreground">
              {scoreMeta(job.matchScore)}
            </span>
          </div>
        </div>

        {allMatchable.length > 0 && (
          <section className="mt-4">
            <h3 className="text-[0.8125rem] font-medium">Skills on this listing</h3>
            <div className="mt-1.5">
              <RadarTagList merged={allMatchable} matched={matched} />
            </div>
          </section>
        )}

        {(job.matchReasons?.length ?? 0) > 0 && (
          <section className="mt-4">
            <h3 className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
              <Sparkles className="size-3.5" />
              Why this score
            </h3>
            <div className="mt-1.5">
              <RadarJobReasonList reasons={job.matchReasons ?? []} />
            </div>
          </section>
        )}

        {job.salary && (
          <section className="mt-4">
            <h3 className="text-[0.8125rem] font-medium">Salary</h3>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">{job.salary}</p>
          </section>
        )}

        {job.description && (
          <section className="mt-4">
            <h3 className="text-[0.8125rem] font-medium">Description</h3>
            <p className="mt-1.5 max-h-72 overflow-y-auto text-[0.8125rem] whitespace-pre-line text-muted-foreground">
              {job.description}
            </p>
          </section>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            render={<a href={job.url} target="_blank" rel="noreferrer noopener" />}
            nativeButton={false}
          >
            Open listing
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  dot,
  value,
  sub,
  highlight,
}: {
  label: string;
  dot: string;
  value: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-1.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]",
        highlight && "border-primary/40 bg-primary/5"
      )}
    >
      <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot)} />
        {label}
      </p>
      <p className="font-mono text-[1.625rem] font-medium">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

function PillRow({ overview }: { overview: JobRadarOverview }) {
  const paused = !overview.config.collectEnabled;
  return (
    <div className="flex items-center gap-2 text-[0.8125rem]">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
          paused
            ? "border-destructive/40 bg-destructive/10 text-destructive-strong"
            : "border-success/40 bg-success/10 text-success-strong"
        )}
      >
        <Globe className="size-3.5" />
        {paused ? "Collection paused" : "Collecting every 6h"}
      </span>
    </div>
  );
}
