"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { timeBlockSchema } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { TimeBlock } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";

type FormValues = z.input<typeof timeBlockSchema>;

const PRIORITY_OPTIONS = [
  { value: "low" as const, label: "Low" },
  { value: "medium" as const, label: "Medium" },
  { value: "high" as const, label: "High" },
];

const STATUS_OPTIONS = [
  { value: "planned" as const, label: "Planned" },
  { value: "in_progress" as const, label: "In progress" },
  { value: "completed" as const, label: "Done" },
];

async function upsertBlock(date: string, values: FormValues) {
  const res = await fetch("/api/timeline/blocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, date }),
  });
  if (!res.ok) throw new Error("Failed to save block");
  return res.json();
}

async function updateBlock(id: string, values: Omit<FormValues, "hour">) {
  const res = await fetch(`/api/timeline/blocks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error("Failed to update block");
  return res.json();
}

export function TimelineForm({
  date,
  hour,
  block,
  onDone,
}: {
  date: string;
  hour: number;
  block?: TimeBlock;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(timeBlockSchema),
    defaultValues: {
      hour,
      title: block?.title ?? "",
      description: block?.description ?? "",
      status: block?.status ?? "planned",
      priority: block?.priority ?? "medium",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      block ? updateBlock(block.id, values) : upsertBlock(date, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(date) });
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="gap-4.5 px-6 pb-6">
        <Field>
          <FieldLabel htmlFor="block-title">Title</FieldLabel>
          <Input id="block-title" placeholder="Deep work: jobs scraper" autoFocus {...register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="block-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id="block-description"
            placeholder="What does done look like?"
            className="min-h-16"
            {...register("description")}
          />
        </Field>
        <Field>
          <FieldLabel>Priority</FieldLabel>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <SegmentedControl
                label="Priority"
                value={field.value ?? "medium"}
                onChange={field.onChange}
                options={PRIORITY_OPTIONS}
              />
            )}
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                label="Status"
                value={field.value ?? "planned"}
                onChange={field.onChange}
                options={STATUS_OPTIONS}
              />
            )}
          />
        </Field>
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">
          Something went wrong. Please try again.
        </p>
      )}
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : block ? "Save changes" : "Save task"}
        </Button>
      </div>
    </form>
  );
}
