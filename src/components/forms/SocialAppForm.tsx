"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { socialAppSchema } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { SocialApp } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

type FormValues = z.infer<typeof socialAppSchema>;

async function createSocialApp(values: FormValues) {
  const res = await fetch("/api/social-apps", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error("Failed to create social app");
  return res.json();
}

async function updateSocialApp(id: string, values: FormValues) {
  const res = await fetch(`/api/social-apps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error("Failed to update social app");
  return res.json();
}

export function SocialAppForm({
  app,
  onDone,
}: {
  app?: SocialApp;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(socialAppSchema),
    defaultValues: {
      platform: app?.platform ?? "",
      username: app?.username ?? "",
      url: app?.url ?? "",
      icon: app?.icon ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      app ? updateSocialApp(app.id, values) : createSocialApp(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialApps });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col"
    >
      <FieldGroup className="gap-[18px] px-6 pb-6">
        <Field>
          <FieldLabel htmlFor="social-platform">Platform</FieldLabel>
          <Input
            id="social-platform"
            placeholder="GitHub"
            autoFocus
            {...register("platform")}
          />
          <FieldError errors={[errors.platform]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="social-username">Username</FieldLabel>
          <Input
            id="social-username"
            placeholder="aymenjdily"
            {...register("username")}
          />
          <FieldError errors={[errors.username]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="social-url">URL</FieldLabel>
          <Input
            id="social-url"
            type="url"
            placeholder="https://github.com/aymenjdily"
            {...register("url")}
          />
          <FieldError errors={[errors.url]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="social-icon">
            Icon <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="social-icon" placeholder="github" {...register("icon")} />
          <FieldDescription>The tile shows a monogram based on the platform name.</FieldDescription>
          <FieldError errors={[errors.icon]} />
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
        <Button type="submit" disabled={isSubmitting || mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : app ? "Save changes" : "Save app"}
        </Button>
      </div>
    </form>
  );
}
