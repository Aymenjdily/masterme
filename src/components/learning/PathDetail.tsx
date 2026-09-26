"use client";

import { ArrowDown, ArrowUp, Check, ExternalLink, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningItem, LearningPath } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { displayUrl } from "@/components/portfolio/shared";
import { ProgressBar } from "@/components/learning/PathCard";
import { PATH_BADGE, nextItemStatus, pathProgress } from "@/components/learning/progress";

const STATUS_LABEL: Record<LearningItem["status"], string> = {
  not_started: "to do",
  in_progress: "in progress",
  completed: "done",
};

const headerButtonClass = "cursor-pointer text-muted-foreground hover:text-foreground";
const rowButtonClass =
  "size-7 cursor-pointer rounded-[7px] bg-card text-muted-foreground shadow-xs hover:bg-card hover:text-foreground disabled:opacity-30";

export type PathDetailHandlers = {
  onToggleStatus: (path: LearningPath) => void;
  onEditPath: (path: LearningPath) => void;
  onDeletePath: (path: LearningPath) => void;
  onAddStep: (path: LearningPath) => void;
  onEditStep: (path: LearningPath, item: LearningItem) => void;
  onDeleteStep: (item: LearningItem) => void;
  onCycleStep: (item: LearningItem) => void;
  onMoveStep: (item: LearningItem, direction: "up" | "down") => void;
  moving: boolean;
};

export function PathDetail({ path, ...handlers }: { path: LearningPath } & PathDetailHandlers) {
  const progress = pathProgress(path);
  const badge = PATH_BADGE[path.status];
  const canToggle = path.status !== "completed";

  return (
    <Card className="gap-0 rounded-[20px] px-6 [--card-spacing:--spacing(5.5)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-semibold tracking-tight">{path.title}</h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          {path.description && (
            <p className="mt-1.5 max-w-xl text-[0.84rem] leading-relaxed text-muted-foreground">
              {path.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          {canToggle && (
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={path.status === "active" ? "Pause path" : "Resume path"}
              onClick={() => handlers.onToggleStatus(path)}
              className={headerButtonClass}
            >
              {path.status === "active" ? <Pause /> : <Play />}
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Edit path"
            onClick={() => handlers.onEditPath(path)}
            className={headerButtonClass}
          >
            <Pencil />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Delete path"
            onClick={() => handlers.onDeletePath(path)}
            className={headerButtonClass}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-4.5 flex items-center gap-2.5">
        <ProgressBar pct={progress.pct} status={path.status} className="h-2" />
        <span className="min-w-8.5 text-right font-mono text-xs font-medium text-muted-foreground">
          {progress.pct}%
        </span>
      </div>

      <div className="mt-5.5 mb-2.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Steps</h3>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {progress.done} done · {progress.inProgress} in progress · {progress.todo} to do
        </span>
      </div>

      {path.items.length > 0 && (
        <ol className="flex flex-col">
          {path.items.map((item, index) => (
            <StepRow
              key={item.id}
              item={item}
              index={index}
              isFirst={index === 0}
              isLast={index === path.items.length - 1}
              moving={handlers.moving}
              onCycle={() => handlers.onCycleStep(item)}
              onMove={(direction) => handlers.onMoveStep(item, direction)}
              onEdit={() => handlers.onEditStep(path, item)}
              onDelete={() => handlers.onDeleteStep(item)}
            />
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={() => handlers.onAddStep(path)}
        className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
      >
        <Plus className="size-4" />
        {path.items.length === 0 ? "Add your first step" : "Add step"}
      </button>
    </Card>
  );
}

function StepRow({
  item,
  index,
  isFirst,
  isLast,
  moving,
  onCycle,
  onMove,
  onEdit,
  onDelete,
}: {
  item: LearningItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  moving: boolean;
  onCycle: () => void;
  onMove: (direction: "up" | "down") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = item.status === "completed";
  const inProgress = item.status === "in_progress";

  return (
    <li className="group grid grid-cols-[22px_26px_1fr_auto] items-center gap-3 rounded-xl border-t p-2.5 transition-colors first:border-t-0 hover:border-transparent hover:bg-background [&:hover+li]:border-transparent">
      <span className="text-right font-mono text-[0.6875rem] text-muted-foreground/60">
        {String(index + 1).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={onCycle}
        aria-label={`${item.title}: ${STATUS_LABEL[item.status]}. Mark as ${STATUS_LABEL[nextItemStatus(item.status)]}`}
        className={cn(
          "flex size-5.5 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-input bg-card outline-none transition-colors hover:border-ring focus-visible:ring-4 focus-visible:ring-ring/20",
          done && "border-success bg-success hover:border-success",
          inProgress && "border-primary bg-[conic-gradient(var(--primary)_0_50%,var(--card)_50%_100%)] hover:border-primary"
        )}
      >
        {done && <Check className="size-3 stroke-3 text-white" />}
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-[0.84rem] font-medium",
              done && "text-muted-foreground line-through decoration-muted-foreground/40"
            )}
          >
            {item.title}
          </span>
          {inProgress && (
            <Badge size="sm" variant="warning">
              In progress
            </Badge>
          )}
        </div>
        {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
        {item.resourceUrl && (
          <a
            href={item.resourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex h-5.5 max-w-full items-center gap-1.5 rounded-md bg-muted px-2 font-mono text-[0.6875rem] text-info-strong hover:underline"
          >
            <ExternalLink className="size-2.75 shrink-0" />
            <span className="truncate">{displayUrl(item.resourceUrl)}</span>
          </a>
        )}
      </div>
      <div className="flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Move ${item.title} up`}
          disabled={isFirst || moving}
          onClick={() => onMove("up")}
          className={rowButtonClass}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Move ${item.title} down`}
          disabled={isLast || moving}
          onClick={() => onMove("down")}
          className={rowButtonClass}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label={`Edit ${item.title}`} onClick={onEdit} className={rowButtonClass}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label={`Delete ${item.title}`} onClick={onDelete} className={rowButtonClass}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
