"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { learningItemStatus } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { LearningItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";

const formSchema = z.object({
  title: z.string().trim().min(1, "Give the step a title"),
  description: z.string(),
  resourceUrl: z.union([z.literal(""), z.string().trim().url("Enter a valid URL, e.g. https://…")]),
  status: learningItemStatus,
});

type FormValues = z.infer<typeof formSchema>;

const STEP_STATUS_OPTIONS = [
  { value: "not_started" as const, label: "To do" },
  { value: "in_progress" as const, label: "In progress" },
  { value: "completed" as const, label: "Done" },
];

async function saveItem(pathId: string, item: LearningItem | undefined, values: FormValues) {
  const body = {
    ...values,
    description: values.description.trim() || null,
    resourceUrl: values.resourceUrl.trim() || null,
  };
  const res = await fetch(item ? `/api/learning-items/${item.id}` : `/api/learning-paths/${pathId}/items`, {
    method: item ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save step");
  return res.json();
}

export function LearningItemForm({
  pathId,
  item,
  onDone,
}: {
  pathId: string;
  item?: LearningItem;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      resourceUrl: item?.resourceUrl ?? "",
      status: item?.status ?? "not_started",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => saveItem(pathId, item, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths });
      onDone();
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="gap-4.5 px-6 pb-6">
        <Field>
          <FieldLabel htmlFor="step-title">Title</FieldLabel>
          <Input id="step-title" placeholder="Lifetimes" autoFocus {...register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="step-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id="step-description"
            placeholder="What to focus on…"
            className="min-h-15"
            {...register("description")}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="step-url">
            Resource URL <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id="step-url"
            type="url"
            placeholder="https://doc.rust-lang.org/book"
            {...register("resourceUrl")}
          />
          <FieldError errors={[errors.resourceUrl]} />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                label="Step status"
                value={field.value}
                onChange={field.onChange}
                options={STEP_STATUS_OPTIONS}
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
          {mutation.isPending ? "Saving…" : item ? "Save changes" : "Add step"}
        </Button>
      </div>
    </form>
  );
}
