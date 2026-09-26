"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Layers, Radar, RefreshCw, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { TechNews } from "@/types";
import { TIME_FILTERS, getDateRange, isWithinRange, type TimeFilter } from "@/lib/date-ranges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StackSidebar } from "@/components/news/StackSidebar";
import { TechNewsList, groupLabel } from "@/components/news/TechNewsList";
import { selectClassName } from "@/components/forms/MonthlyCostForm";

const PAGE_SIZES = [10, 20, 50];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return res.json();
}

/** Page numbers with ellipses: 1 … 4 5 6 … 12 */
function pageList(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** When the radar was last fetched: the stored fetch time, or (older data) the newest item. */
function lastFetchLabel(items: TechNews[], fetchedAt: string | null | undefined) {
  const latest =
    (fetchedAt ? new Date(fetchedAt).getTime() : 0) ||
    items.reduce<number>((max, item) => {
      const t = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return Math.max(max, t);
    }, 0);
  if (!latest) return null;
  const d = new Date(latest);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-US", { month: "short" })}`;
}

function EmptyCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="mt-5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
      <div className="flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-5 py-10 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl border bg-card">{icon}</div>
        <p className="mt-3.5 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>
        {children}
      </div>
    </Card>
  );
}

export function NewsView() {
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const skillsQuery = useQuery({
    queryKey: queryKeys.userSkills,
    queryFn: () => getJson<{ skills: string[]; newsFetchedAt?: string | null }>("/api/user/skills"),
  });
  const newsQuery = useQuery({
    queryKey: queryKeys.techNews,
    queryFn: () => getJson<TechNews[]>("/api/tech-news"),
  });

  const skills = skillsQuery.data?.skills ?? [];
  const items = useMemo(() => newsQuery.data ?? [], [newsQuery.data]);

  const timeFiltered = useMemo(() => {
    const range = getDateRange(timeFilter);
    if (!range) return items;
    return items.filter((item) => item.publishedDate && isWithinRange(new Date(item.publishedDate), range));
  }, [items, timeFilter]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of timeFiltered) for (const tag of item.tags) result[tag] = (result[tag] ?? 0) + 1;
    return result;
  }, [timeFiltered]);

  const filtered = activeSkill ? timeFiltered.filter((item) => item.tags.includes(activeSkill)) : timeFiltered;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const updatedToday = filtered.filter((item) => groupLabel(item.publishedDate) === "Today").length;
  const lastFetch = lastFetchLabel(items, skillsQuery.data?.newsFetchedAt);

  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: async (): Promise<{ itemsFound: number; itemsSaved: number }> => {
      const res = await fetch("/api/news/fetch", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Couldn't refresh the radar.");
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.techNews });
      queryClient.invalidateQueries({ queryKey: queryKeys.userSkills });
    },
  });

  const refreshButton = (
    <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending} className="cursor-pointer">
      <RefreshCw className={cn(refresh.isPending && "animate-spin")} />
      {refresh.isPending ? "Refreshing…" : "Refresh"}
    </Button>
  );

  const loading = skillsQuery.isPending || newsQuery.isPending;
  const failed = skillsQuery.isError || newsQuery.isError;
  const ready = !loading && !failed && skills.length > 0 && items.length > 0;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Tech radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recently updated GitHub repos for the languages and frameworks in your stack. Fetched every day.
          </p>
        </div>
        {skills.length > 0 && (
          <div className="flex items-center gap-3">
            {(refresh.isError || refresh.data) && (
              <span
                className={cn(
                  "font-mono text-xs",
                  refresh.isError ? "text-destructive-strong" : "text-success-strong"
                )}
              >
                {refresh.isError
                  ? refresh.error.message
                  : refresh.data!.itemsSaved > 0
                    ? `${refresh.data!.itemsSaved} new`
                    : "Up to date"}
              </span>
            )}
            {refreshButton}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] lg:grid-cols-[250px_1fr]">
          <Skeleton className="h-80 rounded-[20px]" />
          <Skeleton className="h-130 rounded-[20px]" />
        </div>
      )}
      {failed && <p className="mt-5 text-sm text-destructive-strong">Failed to load the tech radar.</p>}

      {!loading && !failed && skills.length === 0 && (
        <EmptyCard
          icon={<Layers className="size-4.5 text-ring" />}
          title="Add your stack to start the radar"
          description="Pick the languages and frameworks you work with in Settings."
        >
          <Button nativeButton={false} render={<Link href="/settings" />} className="mt-4 cursor-pointer" size="sm">
            <Settings />
            Open Settings
          </Button>
        </EmptyCard>
      )}

      {!loading && !failed && skills.length > 0 && items.length === 0 && (
        <EmptyCard
          icon={<Radar className="size-4.5 text-info-strong" />}
          title="No activity yet"
          description="The radar fills up after the daily fetch. Or fetch it now:"
        >
          <div className="mt-4">{refreshButton}</div>
        </EmptyCard>
      )}

      {ready && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={timeFilter}
              onValueChange={(value) => {
                setTimeFilter(value as TimeFilter);
                setPage(1);
              }}
            >
              <TabsList className="h-auto flex-wrap">
                {TIME_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="cursor-pointer">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="flex flex-wrap gap-4 font-mono text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{filtered.length}</span> repos
              </span>
              <span>
                <span className="font-medium text-foreground">{updatedToday}</span> updated today
              </span>
              {lastFetch && <span>last fetch {lastFetch}</span>}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-[220px_1fr] lg:grid-cols-[250px_1fr]">
            <StackSidebar
              skills={skills}
              activeSkill={activeSkill}
              counts={counts}
              total={timeFiltered.length}
              onSelect={(skill) => {
                setActiveSkill(skill);
                setPage(1);
              }}
            />

            <Card className="gap-0 rounded-[20px] px-2 [--card-spacing:--spacing(1.5)]">
              {pageItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-[0.8125rem] text-muted-foreground">
                  No activity for {activeSkill ?? "your stack"} in this period.
                </p>
              ) : (
                <TechNewsList items={pageItems} />
              )}

              <div className="mx-1 mt-1.5 flex flex-wrap items-center justify-between gap-3 border-t px-2 pt-3.5 pb-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {filtered.length === 0
                    ? "Nothing to show"
                    : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Repos per page"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className={cn(selectClassName, "mr-2 h-8 w-auto rounded-lg font-mono text-xs")}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} / page
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Previous page"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="cursor-pointer"
                  >
                    <ChevronLeft />
                  </Button>
                  {pageList(currentPage, pageCount).map((p, i) =>
                    p === "…" ? (
                      <span key={`gap-${i}`} className="px-1 font-mono text-xs text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        size="sm"
                        variant="outline"
                        aria-current={p === currentPage ? "page" : undefined}
                        onClick={() => setPage(p)}
                        className={cn(
                          "min-w-8 cursor-pointer px-2 font-mono text-xs",
                          p === currentPage ? "border-foreground text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Next page"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="cursor-pointer"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
