"use client";

import { ArrowDown, ArrowUp, Check, Eraser, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeBlock } from "@/types";
import { Button } from "@/components/ui/button";
import { hourLabel } from "@/components/timeline/WakeUpPrompt";

const PRIORITY_TAG: Record<TimeBlock["priority"], { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/8 text-destructive-strong" },
  medium: { label: "Med", className: "bg-muted text-muted-foreground" },
  low: { label: "Low", className: "border text-muted-foreground/70" },
};

const STATUS_LABEL: Record<TimeBlock["status"], string> = {
  planned: "planned",
  in_progress: "in progress",
  completed: "done",
};

export const NEXT_BLOCK_STATUS: Record<TimeBlock["status"], TimeBlock["status"]> = {
  planned: "in_progress",
  in_progress: "completed",
  completed: "planned",
};

const actionClass =
  "size-7 cursor-pointer rounded-[7px] bg-card text-muted-foreground shadow-xs hover:bg-card hover:text-foreground disabled:opacity-30";

export function TimeBlockSlot({
  clockHour,
  block,
  isNow,
  isFirst,
  isLast,
  moving,
  onAdd,
  onEdit,
  onClear,
  onCycle,
  onMove,
  tag,
}: {
  clockHour: number;
  block?: TimeBlock;
  isNow: boolean;
  isFirst: boolean;
  isLast: boolean;
  moving: boolean;
  onAdd: () => void;
  onEdit: (block: TimeBlock) => void;
  onClear: (block: TimeBlock) => void;
  onCycle: (block: TimeBlock) => void;
  onMove: (block: TimeBlock, direction: "up" | "down") => void;
  /** Small label on the right, e.g. "yours" while an AI plan is previewed */
  tag?: string;
}) {
  const status = block?.status;

  return (
    <li className="group/slot grid grid-cols-[52px_22px_1fr] gap-3 sm:grid-cols-[64px_22px_1fr]">
      <div className="pt-3.5 text-right font-mono">
        <span className="block text-[0.8125rem] font-medium">{hourLabel(clockHour)}</span>
        <span className="block text-[0.6875rem] text-muted-foreground">{hourLabel(clockHour + 1)}</span>
      </div>

      <div className="relative flex justify-center">
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 w-0.5 bg-muted",
            isFirst && "top-4.5",
            isLast && "bottom-[calc(100%-18px)]"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "relative mt-4 size-3 rounded-full border-2 border-foreground/15 bg-card",
            status === "completed" && "border-success bg-success",
            status === "in_progress" && "border-primary bg-primary ring-4 ring-primary/20",
            status === "planned" && "border-info"
          )}
        />
      </div>

      {block ? (
        <div
          className={cn(
            "group/block my-1 grid grid-cols-[26px_1fr_auto] items-center gap-3 rounded-[14px] border bg-card px-3.5 py-3 transition-colors hover:bg-background",
            isNow && "border-primary bg-primary/4 ring-3 ring-primary/15 hover:bg-primary/6"
          )}
        >
          <button
            type="button"
            onClick={() => onCycle(block)}
            aria-label={`${block.title}: ${STATUS_LABEL[block.status]}. Mark as ${STATUS_LABEL[NEXT_BLOCK_STATUS[block.status]]}`}
            className={cn(
              "flex size-5.5 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-input bg-card outline-none transition-colors hover:border-ring focus-visible:ring-4 focus-visible:ring-ring/20",
              status === "completed" && "border-success bg-success hover:border-success",
              status === "in_progress" &&
                "border-primary bg-[conic-gradient(var(--primary)_0_50%,var(--card)_50%_100%)] hover:border-primary"
            )}
          >
            {status === "completed" && <Check className="size-3 stroke-3 text-white" />}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  status === "completed" && "text-muted-foreground line-through decoration-muted-foreground/40"
                )}
              >
                {block.title}
              </span>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-md px-1.75 font-mono text-[0.65625rem] font-medium tracking-wide uppercase",
                  PRIORITY_TAG[block.priority].className
                )}
              >
                {PRIORITY_TAG[block.priority].label}
              </span>
              {isNow && (
                <span className="rounded-md bg-primary/15 px-1.75 py-0.5 font-mono text-[0.65625rem] font-medium tracking-wide text-warning-strong">
                  NOW
                </span>
              )}
            </div>
            {block.description && <p className="mt-0.5 text-xs text-muted-foreground">{block.description}</p>}
          </div>

          {tag && (
            <span className="col-start-3 row-start-1 justify-self-end rounded-md border px-1.75 py-0.5 font-mono text-[0.65625rem] font-medium text-muted-foreground transition-opacity group-focus-within/block:opacity-0 group-hover/block:opacity-0">
              {tag}
            </span>
          )}
          <div className="col-start-3 row-start-1 flex justify-end gap-0.5 opacity-0 transition-opacity group-focus-within/block:opacity-100 group-hover/block:opacity-100">
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Move ${block.title} up`}
              disabled={isFirst || moving}
              onClick={() => onMove(block, "up")}
              className={actionClass}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Move ${block.title} down`}
              disabled={isLast || moving}
              onClick={() => onMove(block, "down")}
              className={actionClass}
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Edit ${block.title}`} onClick={() => onEdit(block)} className={actionClass}>
              <Pencil className="size-3.5" />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Clear ${block.title}`} onClick={() => onClear(block)} className={actionClass}>
              <Eraser className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="my-1 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-input text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
        >
          <Plus className="size-4" />
          Add task
        </button>
      )}
    </li>
  );
}
