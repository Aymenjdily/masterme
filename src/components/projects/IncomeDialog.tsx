"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { Project, ProjectBilling } from "@/types";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui-patterns/dialogs";
import { BillingForm } from "@/components/forms/BillingForm";
import { formatAmount } from "@/components/monthly-cost/cost-utils";
import { formatMoney } from "@/components/projects/project-utils";

const rowButtonClass =
  "size-7 cursor-pointer rounded-[7px] text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-xs";

/** Income records of one project: totals, list, and add/edit/delete in the same popup. */
export function IncomeDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  // "add" | a record being edited | null (list only)
  const [editing, setEditing] = useState<"add" | ProjectBilling | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/project-billing/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete income record");
    },
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const billings = project?.billings ?? [];
  const oneTime = billings.filter((b) => b.billingType === "one_time");
  const monthly = billings.filter((b) => b.billingType === "monthly");

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(null);
          setConfirmingId(null);
        }
        onOpenChange(next);
      }}
      title={`Income · ${project?.title ?? ""}`}
      description="One-time build fees and monthly recurring, kept separate."
      className="max-w-lg"
    >
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border bg-background px-3 py-2.5">
            <p className="text-[0.71875rem] text-muted-foreground">One-time total</p>
            <p className="mt-0.5 font-mono text-lg font-medium text-success-strong">{formatMoney(oneTime) ?? "—"}</p>
          </div>
          <div className="rounded-xl border bg-background px-3 py-2.5">
            <p className="text-[0.71875rem] text-muted-foreground">Monthly recurring</p>
            <p className="mt-0.5 font-mono text-lg font-medium text-success-strong">
              {formatMoney(monthly) ? `+${formatMoney(monthly)}` : "—"}
            </p>
          </div>
        </div>

        {billings.length > 0 ? (
          <ul className="mt-3.5">
            {billings.map((billing) =>
              editing !== "add" && editing?.id === billing.id ? (
                <li key={billing.id}>
                  <BillingForm projectId={billing.projectId} billing={billing} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li
                  key={billing.id}
                  className="grid grid-cols-[78px_1fr_auto_auto] items-center gap-3 border-t px-1 py-2.75 first:border-t-0"
                >
                  <span
                    className={cn(
                      "inline-flex h-5.5 items-center justify-center rounded-md font-mono text-[0.65625rem] font-medium tracking-wide uppercase",
                      billing.billingType === "one_time" ? "bg-info/10 text-info-strong" : "bg-success/15 text-success-strong"
                    )}
                  >
                    {billing.billingType === "one_time" ? "One-time" : "Monthly"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.84rem] font-medium">
                      {billing.description || (billing.billingType === "one_time" ? "Build fee" : "Recurring")}
                    </p>
                    {billing.invoiceDate && (
                      <p className="font-mono text-[0.6875rem] text-muted-foreground">
                        {billing.billingType === "one_time" ? "Invoice" : "Since"} {billing.invoiceDate.slice(0, 10)}
                      </p>
                    )}
                  </div>
                  {confirmingId === billing.id ? (
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setConfirmingId(null)} className="cursor-pointer">
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(billing.id)}
                        className="cursor-pointer"
                      >
                        Delete
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-0.5">
                        <Button size="icon-xs" variant="ghost" aria-label="Edit record" onClick={() => setEditing(billing)} className={rowButtonClass}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button size="icon-xs" variant="ghost" aria-label="Delete record" onClick={() => setConfirmingId(billing.id)} className={rowButtonClass}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="text-right font-mono">
                        <p className="text-[0.84rem] font-medium text-success-strong">{formatAmount(billing.amount)}</p>
                        <p className="text-[0.65625rem] text-muted-foreground">
                          {billing.currency}
                          {billing.billingType === "monthly" ? " / mo" : ""}
                        </p>
                      </div>
                    </>
                  )}
                </li>
              )
            )}
          </ul>
        ) : (
          editing !== "add" && (
            <p className="mt-4 text-center text-[0.8125rem] text-muted-foreground">No income recorded yet.</p>
          )
        )}

        {deleteMutation.isError && (
          <p className="mt-2 text-sm text-destructive-strong">Couldn&apos;t delete. Please try again.</p>
        )}

        {editing === "add" && project ? (
          <BillingForm projectId={project.id} onDone={() => setEditing(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing("add")}
            className="mt-3 flex h-10.5 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
          >
            <Plus className="size-3.5" />
            Add income record
          </button>
        )}
      </div>
    </FormDialog>
  );
}
