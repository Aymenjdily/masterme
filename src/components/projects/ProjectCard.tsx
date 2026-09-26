"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { projectStatusVariant, projectTypeVariant, statusLabel } from "@/lib/status-styles";
import { tintAt } from "@/components/portfolio/shared";
import { initials } from "@/components/jobs/job-utils";
import { formatMoney } from "@/components/projects/project-utils";

const overlayButtonClass =
  "size-7.5 cursor-pointer rounded-lg bg-card/90 text-foreground shadow-xs backdrop-blur-sm hover:bg-card";

function MoneyCell({ label, value, tone }: { label: string; value: string | null; tone?: "pos" | "neg" }) {
  return (
    <div className="min-w-0 px-2.5 py-2.25">
      <p className="font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-mono text-[0.8125rem] font-medium",
          value && tone === "pos" && "text-success-strong",
          value && tone === "neg" && "text-destructive-strong"
        )}
        title={value ?? undefined}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  onIncome,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onIncome: () => void;
}) {
  const queryClient = useQueryClient();
  // Remember which image failed, so a refreshed preview (new URL) gets a fresh chance.
  const [failedImage, setFailedImage] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshPreview: true }),
      });
      if (!res.ok) throw new Error("Failed to refresh preview");
    },
    onSuccess: () => {
      setFailedImage(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });

  const oneTime = formatMoney(project.billings.filter((b) => b.billingType === "one_time"));
  const monthly = formatMoney(project.billings.filter((b) => b.billingType === "monthly"));
  // Linked monthly costs first; the Neon estimate (also shown as a chip) only when nothing is linked.
  const linkedInfra = formatMoney(project.monthlyCosts);
  const neonInfra = project.infra ? `~$${project.infra.neonUsd.toFixed(2)}` : null;
  const infra = linkedInfra ? `−${linkedInfra}` : neonInfra;
  const hash = [...project.title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const showImage = project.previewImageUrl && project.previewImageUrl !== failedImage;

  return (
    <li className="group flex flex-col overflow-hidden rounded-[20px] border bg-card shadow-card transition-shadow hover:shadow-[0_12px_32px_#1b1e291a]">
      <div className="relative mx-2 mt-2 aspect-video overflow-hidden rounded-[14px] bg-muted">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.previewImageUrl}
            alt={`${project.title} preview`}
            className="size-full object-cover"
            onError={() => setFailedImage(project.previewImageUrl ?? null)}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2">
            <span className="rounded-[14px] bg-card shadow-xs">
              <span className={cn("flex size-12 items-center justify-center rounded-[14px] text-lg font-bold", tintAt(hash))}>
                {initials(project.title)}
              </span>
            </span>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">No preview image</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <Badge size="sm" variant={projectTypeVariant[project.type] ?? "neutral"} className="bg-card/90 backdrop-blur-sm">
            {project.type === "saas" ? "SaaS" : statusLabel(project.type)}
          </Badge>
          <Badge size="sm" variant={projectStatusVariant[project.status] ?? "neutral"} className="bg-card/90 backdrop-blur-sm">
            {statusLabel(project.status)}
          </Badge>
        </div>
        <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {project.url && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Refresh ${project.title} preview`}
              title="Refresh preview"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
              className={overlayButtonClass}
            >
              <RefreshCw className={cn("size-3.5", refreshMutation.isPending && "animate-spin")} />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${project.title}`} onClick={onEdit} className={overlayButtonClass}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${project.title}`} onClick={onDelete} className={overlayButtonClass}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[0.9375rem] font-semibold">{project.title}</h3>
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${project.title}`}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        {project.type === "client" && project.clientName && (
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Client · {project.clientName}</p>
        )}
        {project.description && (
          <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted-foreground">{project.description}</p>
        )}

        <div className="flex-1" />
        <div className="mt-3.5 grid grid-cols-3 divide-x overflow-hidden rounded-xl border">
          <MoneyCell label="One-time" value={oneTime} tone="pos" />
          <MoneyCell label="Monthly" value={monthly ? `+${monthly}` : null} tone="pos" />
          <MoneyCell label="Infra" value={infra} tone="neg" />
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {project.infra && (
              <span
                title={project.infra.stale ? "Couldn't update today; showing the last reading" : undefined}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-[7px] bg-muted px-2 font-mono text-[0.6875rem] text-muted-foreground",
                  project.infra.stale && "bg-primary/12 text-warning-strong"
                )}
              >
                Neon <span className="font-medium text-foreground">~${project.infra.neonUsd.toFixed(2)}</span>
                {project.infra.stale && " · stale"}
              </span>
            )}
            {project.vercelHosting && (
              <span className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-muted px-2 font-mono text-[0.6875rem] text-muted-foreground">
                Vercel <span className="font-medium text-foreground">shared</span>
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={onIncome} className="shrink-0 cursor-pointer">
            <Coins />
            Income · {project.billings.length}
          </Button>
        </div>
      </div>
    </li>
  );
}
