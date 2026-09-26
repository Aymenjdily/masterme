"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { ProjectBilling } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { selectClassName } from "@/components/forms/MonthlyCostForm";

const TYPE_OPTIONS = [
  { value: "one_time" as const, label: "One-time" },
  { value: "monthly" as const, label: "Monthly" },
];

/** Compact add/edit form shown inside the Income popup. */
export function BillingForm({
  projectId,
  billing,
  onDone,
}: {
  projectId: string;
  billing?: ProjectBilling;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [billingType, setBillingType] = useState<ProjectBilling["billingType"]>(billing?.billingType ?? "one_time");
  const [amount, setAmount] = useState(billing ? String(billing.amount) : "");
  const [currency, setCurrency] = useState(billing?.currency ?? "MAD");
  const [description, setDescription] = useState(billing?.description ?? "");
  const [invoiceDate, setInvoiceDate] = useState(billing?.invoiceDate?.slice(0, 10) ?? "");
  const [amountError, setAmountError] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        billingType,
        amount: Number(amount),
        currency,
        description: description.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
      };
      const res = await fetch(billing ? `/api/project-billing/${billing.id}` : `/api/projects/${projectId}/billing`, {
        method: billing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save income record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const bad = !(Number(amount) > 0);
        setAmountError(bad);
        if (!bad) mutation.mutate();
      }}
      className="mt-3 flex flex-col gap-3.5 rounded-[14px] border bg-background p-4"
    >
      <SegmentedControl label="Income type" value={billingType} onChange={setBillingType} options={TYPE_OPTIONS} />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <Field>
          <FieldLabel htmlFor="billing-amount">Amount{billingType === "monthly" ? " per month" : ""}</FieldLabel>
          <Input
            id="billing-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            className="font-mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <FieldError errors={[amountError ? { message: "Enter an amount above 0" } : undefined]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="billing-currency">Currency</FieldLabel>
          <select
            id="billing-currency"
            className={`${selectClassName} font-mono`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {[...new Set(["MAD", "USD", "EUR", currency])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
        <Field>
          <FieldLabel htmlFor="billing-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="billing-description"
            placeholder="Build: v1 delivery"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="billing-date">Invoice date</FieldLabel>
          <Input
            id="billing-date"
            type="date"
            className="font-mono"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </Field>
      </div>
      {mutation.isError && <p className="text-sm text-destructive-strong">Something went wrong. Please try again.</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : billing ? "Save" : "Add record"}
        </Button>
      </div>
    </form>
  );
}
