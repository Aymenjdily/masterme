"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { learningPathStatus } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { LearningPath } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";

const formSchema = z.object({
  title: z.string().trim().min(1, "Give the path a title"),
  description: z.string(),
  status: learningPathStatus,
});

type FormValues = z.infer<typeof formSchema>;

export const PATH_STATUS_OPTIONS = [
  { value: "active" as const, label: "Active", dotClassName: "bg-info" },
  { value: "paused" as const, label: "Paused", dotClassName: "bg-stone" },
  { value: "completed" as const, label: "Completed", dotClassName: "bg-success" },
];

async function savePath(path: LearningPath | undefined, values: FormValues): Promise<LearningPath> {
  const body = { ...values, description: values.description.trim() || null };
  const res = await fetch(path ? `/api/learning-paths/${path.id}` : "/api/learning-paths", {
    method: path ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save learning path");
  return res.json();
}

export function LearningPathForm({
  path,
  onDone,
}: {
  path?: LearningPath;
  onDone: (saved?: LearningPath) => void;
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
      title: path?.title ?? "",
      description: path?.description ?? "",
      status: path?.status ?? "active",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => savePath(path, values),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths });
      onDone(saved);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col">
      <FieldGroup className="gap-4.5 px-6 pb-6">
        <Field>
          <FieldLabel htmlFor="path-title">Title</FieldLabel>
          <Input id="path-title" placeholder="Rust fundamentals" autoFocus {...register("title")} />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="path-description">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Textarea
            id="path-description"
            placeholder="What you want to learn and why"
            {...register("description")}
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                label="Path status"
                value={field.value}
                onChange={field.onChange}
                options={PATH_STATUS_OPTIONS}
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
        <Button type="button" variant="ghost" onClick={() => onDone()} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : path ? "Save changes" : "Create path"}
        </Button>
      </div>
    </form>
  );
}
