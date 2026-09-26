"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, ExternalLink, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { JobApplication, LearningPath, MonthlyCost, Project, RecruiterContact, TechNews, TimeBlock } from "@/types";
import { Button } from "@/components/ui/button";
import { DraftButton } from "@/components/ai/DraftButton";
import type { DraftSubject } from "@/components/ai/FollowUpWriter";
import { hourLabel } from "@/components/timeline/WakeUpPrompt";
import { pathProgress } from "@/components/learning/progress";
import { StackLogo } from "@/components/news/StackLogo";
import { CopyButton, displayUrl, linkIcon, platformMark, tintAt } from "@/components/portfolio/shared";
import { formatAmount } from "@/components/monthly-cost/cost-utils";
import { EstimateTag, usd } from "@/components/monthly-cost/AppsServicesSummary";
import { initials, shortAgo } from "@/components/jobs/job-utils";
import { Widget, WidgetEmpty, WidgetError, WidgetLoading } from "@/components/dashboard/Widget";
import {
  usePortfolioLinks,
  useSocialApps,
  useTechNews,
} from "@/components/dashboard/data";

const hash = (text: string) => [...text].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

/* ---------- Today ---------- */

export function TodayWidget({
  loading,
  failed,
  wakeUpHour,
  blocks,
  nowSlot,
}: {
  loading: boolean;
  failed: boolean;
  wakeUpHour: number | null;
  blocks: TimeBlock[];
  nowSlot: number | undefined;
}) {
  const nowBlock = nowSlot !== undefined ? blocks.find((b) => b.hour === nowSlot) : undefined;

  return (
    <Widget title="Today" href="/timeline" linkLabel="Open timeline">
      {loading && <WidgetLoading rows={2} />}
      {failed && <WidgetError />}
      {!loading && !failed && wakeUpHour === null && (
        <WidgetEmpty
          title="No plan for today"
          description="Set your wake-up hour to get 8 blocks."
          action={
            <Button size="sm" nativeButton={false} render={<Link href="/timeline" />} className="cursor-pointer">
              <Clock />
              Plan today
            </Button>
          }
        />
      )}
      {!loading && !failed && wakeUpHour !== null && (
        <>
          <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {Array.from({ length: 8 }, (_, slot) => {
              const block = blocks.find((b) => b.hour === slot);
              const isNow = slot === nowSlot;
              return (
                <li key={slot}>
                  <Link
                    href="/timeline"
                    className={cn(
                      "flex h-28 flex-col justify-between rounded-xl border p-2.25 text-[0.71875rem] leading-snug font-medium outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/20",
                      !block && "items-center justify-center border-dashed border-input font-normal text-muted-foreground hover:bg-background",
                      block?.status === "completed" && "border-success/35 bg-success/12 text-success-strong",
                      block?.status === "in_progress" && "border-primary bg-primary/12 text-warning-strong",
                      block?.status === "planned" && "bg-background hover:border-input",
                      isNow && block && "ring-3 ring-primary/20"
                    )}
                  >
                    {block ? (
                      <>
                        <span className="font-mono text-[0.65625rem] opacity-80">{hourLabel(wakeUpHour + slot)}</span>
                        <span className="line-clamp-3">{block.title}</span>
                      </>
                    ) : (
                      <>+ Add</>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
          {nowBlock && nowSlot !== undefined && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <p className="flex items-center gap-2.5 text-[0.8125rem]">
                <span className="rounded-md bg-primary/15 px-1.75 py-0.5 font-mono text-[0.65625rem] font-medium text-warning-strong">
                  NOW
                </span>
                <span className="font-semibold">{nowBlock.title}</span>
                <span className="text-muted-foreground">· {nowBlock.priority} priority</span>
              </p>
              <span className="font-mono text-xs text-muted-foreground">
                {hourLabel(wakeUpHour + nowSlot)} – {hourLabel(wakeUpHour + nowSlot + 1)}
              </span>
            </div>
          )}
        </>
      )}
    </Widget>
  );
}

/* ---------- Follow-ups due ---------- */

async function patch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${url} failed`);
  return res.json();
}

export function FollowUpsWidget({
  loading,
  failed,
  applications,
  recruiters,
}: {
  loading: boolean;
  failed: boolean;
  applications: JobApplication[];
  recruiters: RecruiterContact[];
}) {
  const queryClient = useQueryClient();
  const refresh = (key: readonly string[]) => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
  };
  const appDone = useMutation({
    mutationFn: (id: string) => patch(`/api/job-applications/${id}`, { markFollowedUp: true }),
    onSettled: () => refresh(queryKeys.jobApplications),
  });
  const recruiterDone = useMutation({
    mutationFn: (id: string) => patch(`/api/recruiter-contacts/${id}`, { markContacted: true }),
    onSettled: () => refresh(queryKeys.recruiterContacts),
  });

  const rows = [
    ...applications.map((a) => ({
      key: `a-${a.id}`,
      title: a.jobOffer?.company ?? "Company",
      kind: "application",
      meta: `${a.jobOffer?.title ?? "Application"} · last follow-up ${shortAgo(a.lastFollowUpAt ?? a.applicationDate)}`,
      onDone: () => appDone.mutate(a.id),
      pending: appDone.isPending && appDone.variables === a.id,
      subject: { kind: "application", application: a } as DraftSubject,
    })),
    ...recruiters.map((c) => ({
      key: `r-${c.id}`,
      title: c.name,
      kind: "recruiter",
      meta: `${c.company ? `${c.company} · ` : ""}last contact ${c.lastContactedAt ? shortAgo(c.lastContactedAt) : "—"}`,
      onDone: () => recruiterDone.mutate(c.id),
      pending: recruiterDone.isPending && recruiterDone.variables === c.id,
      subject: { kind: "recruiter", recruiter: c } as DraftSubject,
    })),
  ];

  return (
    <Widget title="Follow-ups due" count={rows.length} href="/jobs" linkLabel="Open jobs">
      {loading && <WidgetLoading />}
      {failed && <WidgetError />}
      {!loading && !failed && rows.length === 0 && (
        <WidgetEmpty title="All caught up" description="Nothing to follow up today." />
      )}
      {!loading && !failed && rows.length > 0 && (
        <ul>
          {rows.slice(0, 5).map((row) => (
            <li key={row.key} className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3 border-t px-1 py-2.5 first:border-t-0">
              <span className={cn("flex size-9 items-center justify-center rounded-[10px] text-xs font-bold", tintAt(hash(row.title)))}>
                {initials(row.title)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.84rem] font-medium">
                  {row.title}
                  <span className="ml-1.5 font-mono text-[0.65625rem] font-normal text-muted-foreground">{row.kind}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{row.meta}</p>
              </div>
              <DraftButton subject={row.subject} className="h-7 gap-1 px-2.5 text-xs [&_svg]:size-3" />
              <Button
                size="sm"
                variant="outline"
                disabled={row.pending}
                onClick={row.onDone}
                aria-label={`Mark ${row.title} as followed up`}
                className="h-7 cursor-pointer border-primary/50 bg-primary/12 px-2.5 text-xs text-warning-strong shadow-none hover:bg-primary/20"
              >
                <Check className="size-3" />
                Done
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}

/* ---------- Learning ---------- */

export function LearningWidget({ loading, failed, paths }: { loading: boolean; failed: boolean; paths: LearningPath[] }) {
  const active = paths.filter((p) => p.status === "active").slice(0, 3);
  return (
    <Widget title="Learning" href="/learning" linkLabel="Open learning">
      {loading && <WidgetLoading rows={2} />}
      {failed && <WidgetError />}
      {!loading && !failed && active.length === 0 && (
        <WidgetEmpty
          title="No active path"
          description="Break a topic into steps."
          action={
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/learning" />} className="cursor-pointer">
              <Plus />
              New path
            </Button>
          }
        />
      )}
      {!loading && !failed && active.length > 0 && (
        <ul className="flex flex-col">
          {active.map((path) => {
            const progress = pathProgress(path);
            return (
              <li key={path.id} className="border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 text-[0.84rem] font-medium">
                  <span className="truncate">{path.title}</span>
                  <span className="font-mono text-[0.71875rem] text-muted-foreground">
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-linear-to-r from-success to-primary" style={{ width: `${progress.pct}%` }} />
                </div>
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {progress.next ? (
                    <>
                      Next: <span className="text-foreground">{progress.next.title}</span>
                    </>
                  ) : progress.total === 0 ? (
                    "No steps yet"
                  ) : (
                    "All steps completed"
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

/* ---------- Money ---------- */

function sumByCurrency(items: { amount: number; currency: string }[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  return totals;
}

function formatMap(totals: Map<string, number>, sign: "+" | "−") {
  if (totals.size === 0) return null;
  return [...totals.entries()].map(([currency, total]) => `${sign}${formatAmount(total)} ${currency}`).join(" ");
}

export function MoneyWidget({
  loading,
  failed,
  projects,
  costs,
  appsUsd,
}: {
  loading: boolean;
  failed: boolean;
  projects: Project[];
  costs: MonthlyCost[];
  appsUsd: number | null;
}) {
  const income = sumByCurrency(projects.flatMap((p) => p.billings.filter((b) => b.billingType === "monthly")));
  const home = sumByCurrency(costs.filter((c) => c.category === "home"));
  const other = sumByCurrency(costs.filter((c) => c.category === "other"));
  const leftOverMad = (income.get("MAD") ?? 0) - (home.get("MAD") ?? 0) - (other.get("MAD") ?? 0);
  const hasAnything = income.size + home.size + other.size > 0 || (appsUsd ?? 0) > 0;

  const rows = [
    { label: "Monthly income", dot: "bg-success", value: formatMap(income, "+"), tone: "text-success-strong" },
    { label: "Home bills", dot: "bg-primary", value: formatMap(home, "−"), tone: "text-destructive-strong" },
    { label: "Other", dot: "bg-stone", value: formatMap(other, "−"), tone: "text-destructive-strong" },
  ].filter((row) => row.value);

  return (
    <Widget title="Money this month" href="/monthly-cost" linkLabel="Details">
      {loading && <WidgetLoading />}
      {failed && <WidgetError />}
      {!loading && !failed && !hasAnything && (
        <WidgetEmpty title="Nothing tracked yet" description="Add project income or your monthly bills." />
      )}
      {!loading && !failed && hasAnything && (
        <>
          <ul>
            {rows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 border-t border-dashed py-2.25 text-[0.8125rem] first:border-t-0">
                <span className="flex items-center gap-2.25 text-muted-foreground">
                  <span className={cn("size-2 rounded-full", row.dot)} />
                  {row.label}
                </span>
                <span className={cn("font-mono text-[0.84rem] font-medium", row.tone)}>{row.value}</span>
              </li>
            ))}
            {appsUsd !== null && appsUsd > 0 && (
              <li className="flex items-center justify-between gap-3 border-t border-dashed py-2.25 text-[0.8125rem] first:border-t-0">
                <span className="flex items-center gap-2.25 text-muted-foreground">
                  <span className="size-2 rounded-full bg-info" />
                  Apps &amp; services <EstimateTag />
                </span>
                <span className="font-mono text-[0.84rem] font-medium text-destructive-strong">−{usd(appsUsd)}</span>
              </li>
            )}
          </ul>
          <div className="flex items-baseline justify-between gap-3 rounded-xl border bg-background px-3.5 py-3">
            <span className="text-[0.8125rem] text-muted-foreground">Left over (MAD)</span>
            <div className="text-right">
              <p className={cn("font-mono text-xl font-medium", leftOverMad >= 0 ? "text-success-strong" : "text-destructive-strong")}>
                {leftOverMad >= 0 ? "+" : "−"}
                {formatAmount(Math.abs(leftOverMad))} MAD
              </p>
              <p className="font-mono text-[0.6875rem] text-muted-foreground">other currencies not converted</p>
            </div>
          </div>
        </>
      )}
    </Widget>
  );
}

/* ---------- Tech radar ---------- */

function timeAgo(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function RadarWidget({ hasSkills }: { hasSkills: boolean }) {
  const { data, isPending, isError } = useTechNews();
  const latest: TechNews[] = (data ?? []).slice(0, 4);

  return (
    <Widget title="Tech radar" href="/news" linkLabel="Open radar">
      {isPending && <WidgetLoading rows={4} />}
      {isError && <WidgetError />}
      {!isPending && !isError && latest.length === 0 && (
        <WidgetEmpty
          title={hasSkills ? "No activity yet" : "No stack yet"}
          description={hasSkills ? "The radar fills up after the next scheduled fetch." : "Add skills in Settings."}
          action={
            hasSkills ? undefined : (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/settings" />} className="cursor-pointer">
                <Settings />
                Settings
              </Button>
            )
          }
        />
      )}
      {latest.length > 0 && (
        <ul>
          {latest.map((item) => {
            const [owner, ...rest] = item.title.split("/");
            return (
              <li key={item.id} className="grid grid-cols-[1fr_auto] items-start gap-3 border-t py-2.25 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 font-mono text-[0.8125rem] hover:underline"
                  >
                    {rest.length ? (
                      <>
                        <span className="truncate text-muted-foreground">{owner} /</span>
                        <span className="truncate font-medium">{rest.join("/")}</span>
                      </>
                    ) : (
                      <span className="truncate font-medium">{item.title}</span>
                    )}
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </a>
                  <div className="mt-1.5 flex flex-wrap gap-1.25">
                    {item.tags.map((tag) => (
                      <span key={tag} className="inline-flex h-5 items-center gap-1.25 rounded-md bg-muted px-1.75 font-mono text-[0.65625rem]">
                        <StackLogo skill={tag} className="size-2.75" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {item.publishedDate && (
                  <span className="font-mono text-[0.71875rem] whitespace-nowrap text-muted-foreground">{timeAgo(item.publishedDate)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

/* ---------- Portfolio ---------- */

export function PortfolioWidget() {
  const links = usePortfolioLinks();
  const socials = useSocialApps();
  const primary = links.data?.[0];
  const apps = socials.data ?? [];
  const loading = links.isPending || socials.isPending;
  const failed = links.isError || socials.isError;

  return (
    <Widget title="Portfolio" href="/portfolio" linkLabel="Manage">
      {loading && <WidgetLoading rows={2} />}
      {failed && <WidgetError />}
      {!loading && !failed && !primary && apps.length === 0 && (
        <WidgetEmpty
          title="No links yet"
          description="Add your portfolio and social profiles."
          action={
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/portfolio" />} className="cursor-pointer">
              <Plus />
              Add link
            </Button>
          }
        />
      )}
      {!loading && !failed && primary && (
        <div className="flex items-center gap-3 rounded-[14px] border bg-background p-3">
          {(() => {
            const Icon = linkIcon(primary.icon);
            return (
              <span className={cn("flex size-9.5 shrink-0 items-center justify-center rounded-[10px]", tintAt(0))}>
                <Icon className="size-4" />
              </span>
            );
          })()}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.84rem] font-medium">{primary.title}</p>
            <p className="truncate font-mono text-[0.71875rem] text-muted-foreground">{displayUrl(primary.url)}</p>
          </div>
          <CopyButton value={primary.url} label={primary.title} />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Open ${primary.title}`}
            nativeButton={false}
            render={<a href={primary.url} target="_blank" rel="noreferrer" />}
            className="cursor-pointer text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ExternalLink />
          </Button>
        </div>
      )}
      {!loading && !failed && apps.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {apps.map((app) => {
            const mark = platformMark(app.platform);
            return (
              <li key={app.id}>
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center gap-2 rounded-[10px] border py-0 pr-2.5 pl-1.5 text-[0.8125rem] outline-none transition-colors hover:bg-background focus-visible:ring-4 focus-visible:ring-ring/20"
                >
                  <span className={cn("flex size-5.5 items-center justify-center rounded-md text-[0.625rem] font-bold", mark.tint)}>
                    {mark.mono}
                  </span>
                  {app.platform}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}

