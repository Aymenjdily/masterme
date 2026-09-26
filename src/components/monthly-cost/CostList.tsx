"use client";

import { Folder, House, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthlyCost } from "@/types";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/portfolio/shared";
import { billKind, formatAmount, formatTotals } from "@/components/monthly-cost/cost-utils";

const rowActionClass =
  "size-7 cursor-pointer rounded-[7px] bg-card text-muted-foreground shadow-xs hover:bg-card hover:text-foreground";

function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-input bg-card px-3 text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:border-ring hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
    >
      <Plus className="size-3.25" />
      {label}
    </button>
  );
}

export function CostList({
  title,
  items,
  suggestions,
  totalLabel,
  projectTitles,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  items: MonthlyCost[];
  suggestions: string[];
  totalLabel?: string;
  projectTitles: Map<string, string>;
  onAdd: (defaultName?: string) => void;
  onEdit: (cost: MonthlyCost) => void;
  onDelete: (cost: MonthlyCost) => void;
}) {
  const existing = new Set(items.map((i) => i.name.toLowerCase()));
  const remaining = suggestions.filter((s) => !existing.has(s.toLowerCase()));
  const total = formatTotals(items);

  return (
    <SectionCard
      title={title}
      count={items.length}
      action={
        <Button size="sm" variant="outline" onClick={() => onAdd()} className="cursor-pointer">
          <Plus />
          Add {title === "Home bills" ? "bill" : "cost"}
        </Button>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-5 py-8 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
            <House className="size-4.5 text-ring" />
          </div>
          <p className="mt-3.5 text-sm font-semibold">No {title.toLowerCase()} yet</p>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            Start with the usual ones. You can edit the amounts after.
          </p>
          {remaining.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {remaining.map((s) => (
                <QuickChip key={s} label={s} onClick={() => onAdd(s)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((cost) => {
              const kind = billKind(cost.name);
              const projectTitle = cost.projectId ? projectTitles.get(cost.projectId) : undefined;
              return (
                <li
                  key={cost.id}
                  className="group grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 rounded-[14px] border bg-card px-3 py-2.75 transition-colors hover:bg-background"
                >
                  <span className={cn("flex size-10 items-center justify-center rounded-[11px]", kind.tint)}>
                    <kind.icon className="size-4.25" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{cost.name}</span>
                      {projectTitle && (
                        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.75 font-mono text-[0.6875rem] text-muted-foreground">
                          <Folder className="size-2.75" />
                          {projectTitle}
                        </span>
                      )}
                    </div>
                    {cost.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{cost.notes}</p>}
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button size="icon-xs" variant="ghost" aria-label={`Edit ${cost.name}`} onClick={() => onEdit(cost)} className={rowActionClass}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label={`Delete ${cost.name}`} onClick={() => onDelete(cost)} className={rowActionClass}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="text-right font-mono">
                    <span className="block text-sm font-medium">{formatAmount(cost.amount)}</span>
                    <span className="block text-[0.65625rem] text-muted-foreground">{cost.currency} / mo</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {remaining.length > 0 && (
            <div>
              <p className="font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Quick add
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {remaining.map((s) => (
                  <QuickChip key={s} label={s} onClick={() => onAdd(s)} />
                ))}
              </div>
            </div>
          )}

          {totalLabel && total && (
            <div className="flex items-center justify-between border-t pt-3.5">
              <span className="text-[0.8125rem] text-muted-foreground">{totalLabel}</span>
              <span className="font-mono text-base font-medium">{total} / mo</span>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
