"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, House, Plus, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { MonthlyCost, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog, FormDialog } from "@/components/ui-patterns/dialogs";
import { MonthlyCostForm, type CostCategory } from "@/components/forms/MonthlyCostForm";
import { AppsServicesSummary, EstimateTag, useAppsSummary, usd } from "@/components/monthly-cost/AppsServicesSummary";
import { CostList } from "@/components/monthly-cost/CostList";
import { formatAmount, totalsByCurrency } from "@/components/monthly-cost/cost-utils";

const HOME_SUGGESTIONS = ["Electricity", "Wifi / Internet", "Water", "Phone", "Rent"];

async function fetchMonthlyCosts(): Promise<MonthlyCost[]> {
  const res = await fetch("/api/monthly-costs");
  if (!res.ok) throw new Error("Failed to load monthly costs");
  return res.json();
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to load projects");
  return res.json();
}

async function deleteCost(id: string) {
  const res = await fetch(`/api/monthly-costs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete cost");
  return res.json();
}

function StatCard({
  icon,
  iconClassName,
  label,
  value,
  unit,
  sub,
}: {
  icon: ReactNode;
  iconClassName: string;
  label: ReactNode;
  value: string;
  unit?: string;
  sub: string;
}) {
  return (
    <Card className="flex-row items-start gap-3.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[11px]", iconClassName)}>{icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">{label}</div>
        <p className="mt-1 truncate font-mono text-2xl font-medium tracking-tight">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}

/** Largest-currency total as the headline; any other currencies go in the subtitle. */
function headline(items: MonthlyCost[]) {
  const totals = totalsByCurrency(items).sort((a, b) => b.total - a.total);
  if (totals.length === 0) return { value: "0", unit: "MAD / mo", extra: "" };
  const [main, ...rest] = totals;
  return {
    value: formatAmount(main.total),
    unit: `${main.currency} / mo`,
    extra: rest.map((t) => `+ ${formatAmount(t.total)} ${t.currency}`).join(" "),
  };
}

export function MonthlyCostView() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<
    { cost?: MonthlyCost; category: CostCategory; defaultName?: string } | null
  >(null);
  const [deleting, setDeleting] = useState<MonthlyCost | null>(null);

  const { data: costs, isPending, isError } = useQuery({
    queryKey: queryKeys.monthlyCosts,
    queryFn: fetchMonthlyCosts,
  });
  const { data: projects } = useQuery({ queryKey: queryKeys.projects, queryFn: fetchProjects });
  const { data: apps } = useAppsSummary();

  const deleteMutation = useMutation({
    mutationFn: (cost: MonthlyCost) => deleteCost(cost.id),
    onSuccess: () => {
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyCosts });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const projectOptions = (projects ?? []).map((p) => ({ id: p.id, title: p.title }));
  const projectTitles = new Map(projectOptions.map((p) => [p.id, p.title]));

  const homeCosts = costs?.filter((c) => c.category === "home") ?? [];
  const otherCosts = costs?.filter((c) => c.category === "other") ?? [];
  const home = headline(homeCosts);
  const other = headline(otherCosts);

  const appProjectCount = apps
    ? new Set([...apps.neon.items, ...apps.vercel.items].map((i) => i.projectId)).size
    : 0;

  const listHandlers = {
    projectTitles,
    onEdit: (cost: MonthlyCost) => setDialog({ cost, category: cost.category }),
    onDelete: (cost: MonthlyCost) => setDeleting(cost),
  };

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Monthly cost</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What you pay every month: app services from your projects, plus home bills.
          </p>
        </div>
        <Button onClick={() => setDialog({ category: "home" })} className="cursor-pointer">
          <Plus />
          Add cost
        </Button>
      </div>

      <div className="mt-5.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <StatCard
          icon={<Server className="size-4.5" />}
          iconClassName="bg-info/12 text-info-strong"
          label={
            <>
              Apps &amp; services <EstimateTag />
            </>
          }
          value={apps ? usd(apps.totalUsd) : "—"}
          unit="/ mo"
          sub={`Neon + Vercel · ${appProjectCount} project${appProjectCount === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<House className="size-4.5" />}
          iconClassName="bg-primary/18 text-warning-strong"
          label="Home bills"
          value={home.value}
          unit={home.unit}
          sub={`${homeCosts.length} bill${homeCosts.length === 1 ? "" : "s"} ${home.extra}`.trim()}
        />
        <StatCard
          icon={<Ellipsis className="size-4.5" />}
          iconClassName="bg-stone/45 text-stone-strong"
          label="Other"
          value={other.value}
          unit={other.unit}
          sub={`${otherCosts.length} cost${otherCosts.length === 1 ? "" : "s"} ${other.extra}`.trim()}
        />
      </div>

      {isError && <p className="mt-4 text-sm text-destructive-strong">Failed to load monthly costs.</p>}

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <AppsServicesSummary />
        <div className="flex flex-col gap-4">
          {isPending ? (
            <Skeleton className="h-80 rounded-[20px]" />
          ) : (
            <>
              <CostList
                title="Home bills"
                items={homeCosts}
                suggestions={HOME_SUGGESTIONS}
                totalLabel="Total home bills"
                onAdd={(defaultName) => setDialog({ category: "home", defaultName })}
                {...listHandlers}
              />
              {otherCosts.length > 0 && (
                <CostList
                  title="Other"
                  items={otherCosts}
                  suggestions={[]}
                  onAdd={() => setDialog({ category: "other" })}
                  {...listHandlers}
                />
              )}
            </>
          )}
        </div>
      </div>

      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.cost ? "Edit monthly cost" : "Add monthly cost"}
        description="A bill or subscription you pay every month."
      >
        {dialog !== null && (
          <MonthlyCostForm
            key={dialog.cost?.id ?? `new-${dialog.defaultName ?? ""}`}
            cost={dialog.cost}
            category={dialog.category}
            defaultName={dialog.defaultName}
            projects={projectOptions}
            onDone={() => setDialog(null)}
          />
        )}
      </FormDialog>

      <DeleteDialog
        name={deleting?.name ?? ""}
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
