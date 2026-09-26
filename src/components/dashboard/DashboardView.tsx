"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, Clock, Coins, Plus, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { useLocalNow } from "@/hooks/use-local-now";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormDialog } from "@/components/ui-patterns/dialogs";
import { AddApplicationForm } from "@/components/forms/ApplicationForms";
import { pathProgress } from "@/components/learning/progress";
import { formatAmount } from "@/components/monthly-cost/cost-utils";
import { useAppsSummary } from "@/components/monthly-cost/AppsServicesSummary";
import {
  useApplications,
  useLearningPaths,
  useMonthlyCosts,
  useProjects,
  useRecruiters,
  useTimeline,
} from "@/components/dashboard/data";
import {
  FollowUpsWidget,
  LearningWidget,
  MoneyWidget,
  PortfolioWidget,
  RadarWidget,
  TodayWidget,
} from "@/components/dashboard/widgets";

function greeting(hour: number) {
  if (hour < 0) return "Welcome back";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function longDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function Kpi({
  label,
  icon: Icon,
  value,
  unit,
  sub,
  pct,
  highlight,
  tone,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  unit?: string;
  sub: string;
  pct?: number;
  highlight?: boolean;
  tone?: "pos";
}) {
  return (
    <Card className={cn("gap-1.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]", highlight && "border-primary/40 bg-primary/5")}>
      <p className="flex items-center justify-between text-[0.8125rem] text-muted-foreground">
        {label}
        <Icon className="size-3.75" />
      </p>
      <p
        className={cn(
          "truncate font-mono text-[1.625rem] font-medium",
          highlight && "text-warning-strong",
          tone === "pos" && "text-success-strong"
        )}
      >
        {value}
        {unit && <span className="ml-1 text-[0.8125rem] font-normal text-muted-foreground">{unit}</span>}
      </p>
      {pct !== undefined && (
        <div className="h-1.25 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-linear-to-r from-success to-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

export function DashboardView({ firstName }: { firstName: string }) {
  const [addingApplication, setAddingApplication] = useState(false);
  const now = useLocalNow();

  const timelineQuery = useTimeline(now.day, now.ready);
  const applications = useApplications();
  const recruiters = useRecruiters();
  const learning = useLearningPaths();
  const projects = useProjects();
  const costs = useMonthlyCosts();
  const apps = useAppsSummary();
  const skills = useQuery({
    queryKey: queryKeys.userSkills,
    queryFn: async (): Promise<{ skills: string[] }> => {
      const res = await fetch("/api/user/skills");
      if (!res.ok) throw new Error("Failed to load skills");
      return res.json();
    },
  });

  // Today
  const timeline = timelineQuery.data?.timeline ?? null;
  const blocks = timeline?.blocks ?? [];
  const wakeUpHour = timeline?.wakeUpHour ?? null;
  const doneBlocks = blocks.filter((b) => b.status === "completed").length;
  const nowSlot =
    wakeUpHour !== null
      ? Array.from({ length: 8 }, (_, slot) => slot).find((slot) => (wakeUpHour + slot) % 24 === now.hour)
      : undefined;

  // Follow-ups
  const dueApps = (applications.data ?? []).filter((a) => a.dueForFollowUp);
  const dueRecruiters = (recruiters.data ?? []).filter((c) => c.dueForFollowUp);
  const dueCount = dueApps.length + dueRecruiters.length;

  // Learning
  const activePaths = (learning.data ?? []).filter((p) => p.status === "active");
  const learningTotals = activePaths.reduce(
    (acc, path) => {
      const progress = pathProgress(path);
      return { done: acc.done + progress.done, total: acc.total + progress.total };
    },
    { done: 0, total: 0 }
  );

  // Monthly recurring income (headline in MAD, other currencies in the subtitle)
  const monthlyByCurrency = new Map<string, number>();
  for (const project of projects.data ?? []) {
    for (const billing of project.billings.filter((b) => b.billingType === "monthly")) {
      monthlyByCurrency.set(billing.currency, (monthlyByCurrency.get(billing.currency) ?? 0) + billing.amount);
    }
  }
  const earningProjects = (projects.data ?? []).filter((p) => p.billings.some((b) => b.billingType === "monthly")).length;
  const [mainCurrency, mainTotal] = [...monthlyByCurrency.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["MAD", 0];

  const subParts = [
    timeline ? `${doneBlocks} of 8 blocks done` : "no plan yet",
    `${dueCount} follow-up${dueCount === 1 ? "" : "s"} due`,
  ];

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">
            {greeting(now.hour)}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
            {now.ready ? `${longDate(now.day)} · ` : ""}
            {subParts.join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddingApplication(true)} className="h-9 cursor-pointer">
            <Plus />
            Add application
          </Button>
          <Button nativeButton={false} render={<Link href="/timeline" />} className="h-9 cursor-pointer">
            <Clock />
            Plan today
          </Button>
        </div>
      </div>

      <div className="mt-5.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Kpi
          label="Today"
          icon={Clock}
          value={timeline ? String(doneBlocks) : "—"}
          unit={timeline ? "/ 8" : undefined}
          pct={timeline ? (doneBlocks / 8) * 100 : undefined}
          sub={timeline ? "blocks completed" : "no plan for today"}
        />
        <Kpi
          label="Follow-ups due"
          icon={Bell}
          value={String(dueCount)}
          highlight={dueCount > 0}
          sub={
            dueCount > 0
              ? `${dueApps.length} application${dueApps.length === 1 ? "" : "s"} · ${dueRecruiters.length} recruiter${dueRecruiters.length === 1 ? "" : "s"}`
              : "all caught up"
          }
        />
        <Kpi
          label="Learning"
          icon={Route}
          value={String(learningTotals.done)}
          unit={`/ ${learningTotals.total}`}
          pct={learningTotals.total ? (learningTotals.done / learningTotals.total) * 100 : 0}
          sub={`steps across ${activePaths.length} active path${activePaths.length === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Monthly recurring"
          icon={Coins}
          value={formatAmount(mainTotal)}
          unit={mainCurrency}
          tone={mainTotal > 0 ? "pos" : undefined}
          sub={`from ${earningProjects} project${earningProjects === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <TodayWidget
            loading={!now.ready || timelineQuery.isPending}
            failed={timelineQuery.isError}
            wakeUpHour={wakeUpHour}
            blocks={blocks}
            nowSlot={nowSlot}
          />
          <FollowUpsWidget
            loading={applications.isPending || recruiters.isPending}
            failed={applications.isError || recruiters.isError}
            applications={dueApps}
            recruiters={dueRecruiters}
          />
          <RadarWidget hasSkills={(skills.data?.skills.length ?? 0) > 0} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <LearningWidget loading={learning.isPending} failed={learning.isError} paths={learning.data ?? []} />
          <MoneyWidget
            loading={projects.isPending || costs.isPending}
            failed={projects.isError || costs.isError}
            projects={projects.data ?? []}
            costs={costs.data ?? []}
            appsUsd={apps.data?.totalUsd ?? null}
          />
          <PortfolioWidget />
        </div>
      </div>

      <FormDialog
        open={addingApplication}
        onOpenChange={setAddingApplication}
        title="Add application"
        description="You'll get a follow-up reminder every 3 days."
      >
        {addingApplication && <AddApplicationForm onDone={() => setAddingApplication(false)} />}
      </FormDialog>
    </div>
  );
}
