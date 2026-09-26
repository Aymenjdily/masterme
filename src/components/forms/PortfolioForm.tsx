"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { portfolioLinkSchema } from "@/lib/validations";
import { queryKeys } from "@/lib/query-keys";
import type { PortfolioLink } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LINK_ICON_NAMES } from "@/components/portfolio/shared";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

type FormValues = z.infer<typeof portfolioLinkSchema>;

async function createPortfolioLink(values: FormValues) {
  const res = await fetch("/api/portfolio-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error("Failed to create portfolio link");
  return res.json();
}

async function updatePortfolioLink(id: string, values: FormValues) {
  const res = await fetch(`/api/portfolio-links/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error("Failed to update portfolio link");
  return res.json();
}

export function PortfolioForm({
  link,
  onDone,
}: {
  link?: PortfolioLink;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(portfolioLinkSchema),
    defaultValues: {
      title: link?.title ?? "",
      url: link?.url ?? "",
      icon: link?.icon ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      link ? updatePortfolioLink(link.id, values) : createPortfolioLink(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioLinks });
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
          <FieldLabel htmlFor="portfolio-title">Title</FieldLabel>
          <Input
            id="portfolio-title"
            placeholder="Portfolio"
            autoFocus
            {...register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="portfolio-url">URL</FieldLabel>
          <Input
            id="portfolio-url"
            type="url"
            placeholder="https://aymenjdily.com"
            {...register("url")}
          />
          <FieldError errors={[errors.url]} />
        </Field>
        <Field>
          <FieldLabel htmlFor="portfolio-icon">
            Icon <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="portfolio-icon" placeholder="globe" {...register("icon")} />
          <FieldDescription>
            One of: {LINK_ICON_NAMES.join(", ")}
          </FieldDescription>
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
          {mutation.isPending ? "Saving…" : link ? "Save changes" : "Save link"}
        </Button>
      </div>
    </form>
  );
}
