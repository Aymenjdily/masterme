"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteDialog, EmptyState, FormDialog } from "@/components/ui-patterns/dialogs";
import { ProjectForm } from "@/components/forms/ProjectForm";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { IncomeDialog } from "@/components/projects/IncomeDialog";
import { formatMoney } from "@/components/projects/project-utils";
import { updatedLabel, useAppsSummary, useRecalculateInfra, usd } from "@/components/monthly-cost/AppsServicesSummary";

type TypeFilter = "all" | Project["type"];
type StatusFilter = "any" | Project["status"];

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "client", label: "Client" },
  { value: "personal", label: "Personal" },
  { value: "saas", label: "SaaS" },
];

const STATUS_CHIPS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: "any", label: "Any status" },
  { value: "active", label: "Active", dot: "bg-success" },
  { value: "paused", label: "Paused", dot: "bg-stone" },
  { value: "completed", label: "Completed", dot: "bg-muted-foreground" },
];

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

function StatCard({
  label,
  value,
  sub,
  tone,
  action,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: "pos" | "neg";
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-1.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] text-muted-foreground">{label}</p>
        {action}
      </div>
      <p
        className={cn(
          "truncate font-mono text-xl font-medium",
          tone === "pos" && "text-success-strong",
          tone === "neg" && "text-destructive-strong"
        )}
        title={value}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

export function ProjectsView() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [formProject, setFormProject] = useState<"add" | Project | null>(null);
  const [incomeId, setIncomeId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const { data: projects, isPending, isError } = useQuery({ queryKey: queryKeys.projects, queryFn: fetchProjects });
  const { data: apps } = useAppsSummary();
  const recalc = useRecalculateInfra();

  const deleteMutation = useMutation({
    mutationFn: async (project: Project) => {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
    },
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.invalidateQueries({ queryKey: queryKeys.appsSummary });
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyCosts });
    },
  });

  const all = projects ?? [];
  const active = all.filter((p) => p.status === "active");
  const billings = all.flatMap((p) => p.billings);
  const oneTime = formatMoney(billings.filter((b) => b.billingType === "one_time"));
  const monthly = formatMoney(billings.filter((b) => b.billingType === "monthly"));
  const earning = all.filter((p) => p.billings.some((b) => b.billingType === "monthly")).length;
  const linkedCosts = formatMoney(all.flatMap((p) => p.monthlyCosts));
  const infra = [linkedCosts, apps && apps.totalUsd > 0 ? usd(apps.totalUsd) : null].filter(Boolean).join(" + ");

  const typeCount = (type: TypeFilter) => (type === "all" ? all.length : all.filter((p) => p.type === type).length);
  const visible = all.filter(
    (p) => (typeFilter === "all" || p.type === typeFilter) && (statusFilter === "any" || p.status === statusFilter)
  );
  const activeSplit = (["client", "personal", "saas"] as const)
    .map((t) => ({ t, n: active.filter((p) => p.type === t).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.n} ${x.t === "saas" ? "SaaS" : x.t}`)
    .join(" · ");

  const editing = formProject && formProject !== "add" ? formProject : undefined;
  const incomeProject = all.find((p) => p.id === incomeId);

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Client, personal and SaaS projects with their income and running costs.
          </p>
        </div>
        <Button onClick={() => setFormProject("add")} className="cursor-pointer">
          <Plus />
          New project
        </Button>
      </div>

      <div className="mt-5.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Active projects" value={`${active.length} of ${all.length}`} sub={activeSplit || "none active"} />
        <StatCard label="One-time income" value={oneTime ?? "0"} sub="build fees, all time" tone={oneTime ? "pos" : undefined} />
        <StatCard
          label="Monthly recurring"
          value={monthly ? `${monthly} / mo` : "0"}
          sub={`from ${earning} project${earning === 1 ? "" : "s"}`}
          tone={monthly ? "pos" : undefined}
        />
        <StatCard
          label="Monthly infra"
          value={infra || "0"}
          tone={infra ? "neg" : undefined}
          sub={
            recalc.isError ? (
              <span className="text-destructive-strong">{recalc.error.message}</span>
            ) : recalc.data?.failed.length ? (
              <span className="text-warning-strong">
                {recalc.data.failed.length} project{recalc.data.failed.length === 1 ? "" : "s"} couldn&apos;t be updated
              </span>
            ) : (
              <span className={cn(apps?.staleCount && "text-warning-strong")}>
                {recalc.isPending ? "Recalculating…" : `Updated ${updatedLabel(apps?.updatedAt)}`}
              </span>
            )
          }
          action={
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="Recalculate infra cost"
              title="Recalculate infra cost"
              disabled={recalc.isPending}
              onClick={() => recalc.mutate()}
              className="size-6.5 cursor-pointer rounded-md text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn("size-3.5", recalc.isPending && "animate-spin")} />
            </Button>
          }
        />
      </div>

      {all.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <TabsList>
              {TYPE_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="cursor-pointer">
                  {t.label}
                  <span className="font-mono text-[0.6875rem] text-muted-foreground">{typeCount(t.value)}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                role="radio"
                aria-checked={statusFilter === chip.value}
                onClick={() => setStatusFilter(chip.value)}
                className={cn(
                  "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-card px-3 text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
                  statusFilter === chip.value && "border-foreground font-medium text-foreground"
                )}
              >
                {chip.dot && <span className={cn("size-1.75 rounded-full", chip.dot)} />}
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPending && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-[20px]" />
          ))}
        </div>
      )}
      {isError && <p className="mt-4 text-sm text-destructive-strong">Failed to load projects.</p>}

      {projects && projects.length === 0 && (
        <Card className="mt-5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Add a client, personal or SaaS project to track its income and costs."
            actionLabel="New project"
            primary
            onAction={() => setFormProject("add")}
          />
        </Card>
      )}

      {all.length > 0 && visible.length === 0 && (
        <p className="mt-4 rounded-[20px] border border-dashed border-input bg-background px-4 py-10 text-center text-[0.8125rem] text-muted-foreground">
          No projects match these filters.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-3.5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setFormProject(project)}
              onDelete={() => setDeleting(project)}
              onIncome={() => setIncomeId(project.id)}
            />
          ))}
        </ul>
      )}

      <FormDialog
        open={formProject !== null}
        onOpenChange={(open) => !open && setFormProject(null)}
        title={editing ? "Edit project" : "New project"}
        description="A preview image is fetched from the live URL when you save."
        className="max-w-lg"
      >
        {formProject !== null && (
          <ProjectForm key={editing?.id ?? "new"} project={editing} onDone={() => setFormProject(null)} />
        )}
      </FormDialog>

      <IncomeDialog
        project={incomeProject}
        open={incomeId !== null}
        onOpenChange={(open) => !open && setIncomeId(null)}
      />

      <DeleteDialog
        name={deleting?.title ?? ""}
        open={deleting !== null}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setDeleting(null);
          deleteMutation.reset();
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
