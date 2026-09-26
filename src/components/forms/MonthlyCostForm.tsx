"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { monthlyCostSchema } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { MonthlyCost } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";

type FormValues = z.input<typeof monthlyCostSchema>;
export type CostCategory = MonthlyCost["category"];
export type ProjectOption = { id: string; title: string };

const CURRENCIES = ["MAD", "USD", "EUR"];

const CATEGORY_OPTIONS = [
  { value: "home" as const, label: "Home" },
  { value: "other" as const, label: "Other" },
];

export const selectClassName =
  "h-10 w-full min-w-0 cursor-pointer rounded-[10px] border border-input bg-card px-3 text-sm text-foreground outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 dark:bg-background";

async function saveCost(cost: MonthlyCost | undefined, values: FormValues) {
  const payload = { ...values, projectId: values.projectId || null };
  const res = await fetch(cost ? `/api/monthly-costs/${cost.id}` : "/api/monthly-costs", {
    method: cost ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save cost");
  return res.json();
}

export function MonthlyCostForm({
  cost,
  category,
  defaultName,
  projects,
  onDone,
}: {
  cost?: MonthlyCost;
  category: CostCategory;
  defaultName?: string;
  projects: ProjectOption[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(monthlyCostSchema),
    defaultValues: {
      name: cost?.name ?? defaultName ?? "",
      category: cost?.category ?? category,
      amount: cost?.amount ?? ("" as unknown as number),
      currency: cost?.currency ?? "MAD",
      notes: cost?.notes ?? "",
      projectId: cost?.projectId ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => saveCost(cost, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.monthlyCosts });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      onDone();
    },
  });

  // Keep an existing "app" cost editable without silently moving it.
  const categoryOptions =
    cost?.category === "app"
      ? [{ value: "app" as const, label: "App" }, ...CATEGORY_OPTIONS]
      : CATEGORY_OPTIONS;
  const currencies =
    cost?.currency && !CURRENCIES.includes(cost.currency) ? [...CURRENCIES, cost.currency] : CURRENCIES;

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="gap-4.5 px-6 pb-6">
        <Field>
          <FieldLabel htmlFor="cost-name">Name</FieldLabel>
          <Input
            id="cost-name"
            placeholder="Electricity"
            autoFocus={!defaultName}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field>
          <FieldLabel>Category</FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <SegmentedControl
                label="Category"
                value={field.value ?? "home"}
                onChange={field.onChange}
                options={categoryOptions}
              />
            )}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost-amount">Amount per month</FieldLabel>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Input
              id="cost-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0"
              autoFocus={!!defaultName}
              className="font-mono"
              {...register("amount", { valueAsNumber: true })}
            />
            <select aria-label="Currency" className={`${selectClassName} font-mono`} {...register("currency")}>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <FieldError errors={[errors.amount && { message: "Enter an amount above 0" }]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="cost-notes" placeholder="Provider, billing cycle…" {...register("notes")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cost-project">
            Link to a project <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <select id="cost-project" className={selectClassName} {...register("projectId")}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <FieldDescription>Linked costs also show on that project&apos;s card.</FieldDescription>
        </Field>
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">Something went wrong. Please try again.</p>
      )}
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : cost ? "Save changes" : "Save cost"}
        </Button>
      </div>
    </form>
  );
}
