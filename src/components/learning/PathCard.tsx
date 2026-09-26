"use client";

import { cn } from "@/lib/utils";
import type { LearningPath } from "@/types";
import { Badge } from "@/components/ui/badge";
import { PATH_BADGE, pathProgress } from "@/components/learning/progress";

export function ProgressBar({
  pct,
  status,
  className,
}: {
  pct: number;
  status: LearningPath["status"];
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 flex-1 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          status === "completed" && "bg-success",
          status === "paused" && "bg-foreground/15",
          status === "active" && "bg-linear-to-r from-success to-primary"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function PathCard({
  path,
  selected,
  onSelect,
}: {
  path: LearningPath;
  selected: boolean;
  onSelect: () => void;
}) {
  const progress = pathProgress(path);
  const badge = PATH_BADGE[path.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-card outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-ring/20",
        selected ? "border-transparent ring-2 ring-primary" : "hover:border-input"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <span className="text-sm leading-snug font-semibold">{path.title}</span>
        <Badge size="sm" variant={badge.variant}>
          {badge.label}
        </Badge>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <ProgressBar pct={progress.pct} status={path.status} />
        <span className="min-w-8.5 text-right font-mono text-[0.6875rem] font-medium text-muted-foreground">
          {progress.done}/{progress.total}
        </span>
      </div>
      <p className="mt-2.5 truncate text-xs text-muted-foreground">
        {progress.total === 0 ? (
          "No steps yet"
        ) : progress.next ? (
          <>
            Next: <span className="text-foreground">{progress.next.title}</span>
          </>
        ) : (
          "All steps completed"
        )}
      </p>
    </button>
  );
}
