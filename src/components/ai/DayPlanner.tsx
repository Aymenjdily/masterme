"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Coffee, FolderKanban, Newspaper, Pencil, Plus, RefreshCw, Route, Send, Sparkles, StickyNote, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeBlock } from "@/types";
import type { DayPlanResult, PlanCounts, PlanInclude, PlanSource, PlanSuggestion } from "@/lib/ai/day-plan-kinds";
import { SOURCE_LABEL } from "@/lib/ai/day-plan-kinds";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { percent } from "@/components/ai/ConfidenceMeter";
import { hourLabel } from "@/components/timeline/WakeUpPrompt";

// AI day planner UI: plan dialog, suggestion rows on the timeline, banner, side panel, edit dialog.

export type PlanEdit = { title: string; priority: TimeBlock["priority"] };
export type PlanState = {
  result: DayPlanResult;
  dropped: Set<string>;
  edits: Record<string, PlanEdit>;
};

export const SOURCE_STYLE: Record<PlanSource, { icon: typeof Route; chip: string; bar: string }> = {
  project: { icon: FolderKanban, chip: "bg-special/12 text-special-strong", bar: "bg-special" },
  followups: { icon: Send, chip: "bg-info/12 text-info-strong", bar: "bg-info" },
  learning: { icon: Route, chip: "bg-success/15 text-success-strong", bar: "bg-success" },
  notes: { icon: StickyNote, chip: "bg-primary/15 text-warning-strong", bar: "bg-primary" },
  radar: { icon: Newspaper, chip: "bg-stone/45 text-stone-strong", bar: "bg-stone" },
  break: { icon: Coffee, chip: "bg-muted text-muted-foreground", bar: "bg-foreground/15" },
};

const PRIORITY_TAG: Record<TimeBlock["priority"], { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/8 text-destructive-strong" },
  medium: { label: "Med", className: "bg-muted text-muted-foreground" },
  low: { label: "Low", className: "border text-muted-foreground/70" },
};

export function SourceChip({ source, count }: { source: PlanSource; count?: number }) {
  const style = SOURCE_STYLE[source];
  const label = source === "followups" && count && count > 1 ? `${count} follow-ups` : SOURCE_LABEL[source];
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-md px-1.75 font-mono text-[0.65625rem] font-medium", style.chip)}>
      <style.icon className="size-2.75" />
      {label}
    </span>
  );
}

export function keptSuggestions(plan: PlanState) {
  return plan.result.suggestions
    .filter((s) => !plan.dropped.has(s.key))
    .map((s) => ({ ...s, ...(plan.edits[s.key] ?? {}) }));
}

/* ---------------- Timeline rows ---------------- */

export function SuggestionSlot({
  clockHour,
  suggestion,
  edit,
  dropped,
  isFirst,
  isLast,
  onToggle,
  onEdit,
}: {
  clockHour: number;
  suggestion: PlanSuggestion;
  edit?: PlanEdit;
  dropped: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const title = edit?.title ?? suggestion.title;
  const priority = edit?.priority ?? suggestion.priority;
  return (
    <li className="grid grid-cols-[52px_22px_1fr] gap-3 sm:grid-cols-[64px_22px_1fr]">
      <div className="pt-3.5 text-right font-mono">
        <span className="block text-[0.8125rem] font-medium">{hourLabel(clockHour)}</span>
        <span className="block text-[0.6875rem] text-muted-foreground">{hourLabel(clockHour + 1)}</span>
      </div>
      <div className="relative flex justify-center">
        <span aria-hidden className={cn("absolute inset-y-0 w-0.5 bg-muted", isFirst && "top-4.5", isLast && "bottom-[calc(100%-18px)]")} />
        <span aria-hidden className={cn("relative mt-4 size-3 rounded-full border-2 bg-card", dropped ? "border-foreground/15" : "border-info")} />
      </div>
      <div
        className={cn(
          "my-1 grid grid-cols-[26px_1fr_auto] items-center gap-3 rounded-[14px] border-[1.5px] border-dashed px-3.5 py-3 transition-opacity",
          dropped ? "border-input bg-card opacity-50" : "border-ring/60 bg-primary/5"
        )}
      >
        <span className="flex size-5.5 items-center justify-center rounded-[7px] bg-primary/15 text-ring">
          <Sparkles className="size-3.25" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", dropped && "line-through decoration-muted-foreground/40")}>{title}</span>
            <span className={cn("inline-flex h-5 items-center rounded-md px-1.75 font-mono text-[0.65625rem] font-medium tracking-wide uppercase", PRIORITY_TAG[priority].className)}>
              {PRIORITY_TAG[priority].label}
            </span>
            <SourceChip source={suggestion.source} count={suggestion.count} />
          </div>
          <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
            {dropped ? "dropped by you" : edit ? `edited · ${suggestion.why}` : suggestion.why}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {suggestion.confidence !== null && (
            <span className="mr-1 font-mono text-[0.6875rem] font-medium text-warning-strong">{percent(suggestion.confidence)}</span>
          )}
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={`Keep ${title}`}
            aria-pressed={!dropped}
            onClick={() => dropped && onToggle()}
            className={cn(
              "size-7 cursor-pointer rounded-lg",
              !dropped && "border-success/40 bg-success/15 text-success-strong hover:bg-success/25"
            )}
          >
            <Check className="size-3.5" />
          </Button>
          <Button
            size="icon-xs"
            variant="outline"
            aria-label={`Drop ${title}`}
            aria-pressed={dropped}
            onClick={() => !dropped && onToggle()}
            className={cn("size-7 cursor-pointer rounded-lg", dropped && "bg-muted text-foreground")}
          >
            <X className="size-3.5" />
          </Button>
          {!dropped && (
            <Button size="icon-xs" variant="outline" aria-label={`Edit ${title}`} onClick={onEdit} className="size-7 cursor-pointer rounded-lg">
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function BufferSlot({ clockHour, isFirst, isLast, onAdd }: { clockHour: number; isFirst: boolean; isLast: boolean; onAdd: () => void }) {
  return (
    <li className="grid grid-cols-[52px_22px_1fr] gap-3 sm:grid-cols-[64px_22px_1fr]">
      <div className="pt-3.5 text-right font-mono">
        <span className="block text-[0.8125rem] font-medium">{hourLabel(clockHour)}</span>
        <span className="block text-[0.6875rem] text-muted-foreground">{hourLabel(clockHour + 1)}</span>
      </div>
      <div className="relative flex justify-center">
        <span aria-hidden className={cn("absolute inset-y-0 w-0.5 bg-muted", isFirst && "top-4.5", isLast && "bottom-[calc(100%-18px)]")} />
        <span aria-hidden className="relative mt-4 size-3 rounded-full border-2 border-foreground/15 bg-card" />
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="my-1 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-input text-[0.8125rem] text-muted-foreground outline-none hover:bg-background focus-visible:ring-4 focus-visible:ring-ring/20"
      >
        <Plus className="size-3.5" />
        Left free on purpose · buffer for what comes up
      </button>
    </li>
  );
}

/* ---------------- Banner + panel ---------------- */

export function PlanBanner({
  plan,
  accepting,
  onDiscard,
  onReplan,
  onAccept,
}: {
  plan: PlanState;
  accepting: boolean;
  onDiscard: () => void;
  onReplan: () => void;
  onAccept: () => void;
}) {
  const kept = keptSuggestions(plan).length;
  return (
    <div className="mt-4.5 flex flex-wrap items-center gap-3 rounded-[14px] border border-primary/40 bg-primary/5 px-3.5 py-3">
      <span className="flex size-8.5 shrink-0 items-center justify-center rounded-[10px] bg-primary/18 text-ring">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          AI plan preview · {plan.result.suggestions.length} suggestion{plan.result.suggestions.length === 1 ? "" : "s"}
        </p>
        <p className="text-[0.8125rem] text-muted-foreground">Nothing is saved yet. Keep or drop each block, then accept.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onDiscard} disabled={accepting} className="h-8.5 cursor-pointer">
          Discard
        </Button>
        <Button variant="outline" onClick={onReplan} disabled={accepting} className="h-8.5 cursor-pointer">
          <RefreshCw />
          Replan
        </Button>
        <Button onClick={onAccept} disabled={accepting || kept === 0} className="h-8.5 cursor-pointer">
          <Check />
          {accepting ? "Adding…" : `Accept ${kept} block${kept === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

export function PlanPanel({
  plan,
  ownBlocks,
  accepting,
  onAccept,
  onDiscard,
}: {
  plan: PlanState;
  ownBlocks: number;
  accepting: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const kept = keptSuggestions(plan);
  const work = kept.filter((s) => s.source !== "break").length;
  const hasBreak = kept.some((s) => s.source === "break");
  const bySource = (["project", "followups", "notes", "learning", "radar", "break"] as PlanSource[])
    .map((source) => ({ source, hours: kept.filter((s) => s.source === source).length }))
    .filter((row) => row.hours > 0);
  const rest = 8 - kept.length;

  return (
    <Card className="gap-0 rounded-[20px] px-5">
      <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Sparkles className="size-4 text-ring" />
        AI plan
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {work} of your {plan.result.openCount} open item{plan.result.openCount === 1 ? "" : "s"} fit today
        {hasBreak ? ", plus a lunch break" : ""}. The rest stay where they are.
      </p>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {bySource.map((row) => (
          <i key={row.source} className={cn("block h-full", SOURCE_STYLE[row.source].bar)} style={{ flex: row.hours }} />
        ))}
        {rest > 0 && <i className="block h-full bg-muted" style={{ flex: rest }} />}
      </div>
      <ul className="mt-3 flex flex-col gap-2.25 text-[0.8125rem]">
        {bySource.map((row) => (
          <li key={row.source} className="flex items-center gap-2.5">
            <i className={cn("block size-2.5 rounded-[3px]", SOURCE_STYLE[row.source].bar)} />
            {SOURCE_LABEL[row.source] === "Project" ? "Projects" : SOURCE_LABEL[row.source]}
            <b className="ml-auto font-mono text-[0.78rem] font-medium">{row.hours}h</b>
          </li>
        ))}
        <li className="flex items-center gap-2.5">
          <i className="block size-2.5 rounded-[3px] border bg-muted" />
          Yours + free
          <b className="ml-auto font-mono text-[0.78rem] font-medium">{rest}h</b>
        </li>
      </ul>

      {plan.result.notToday.length > 0 && (
        <div className="mt-4 border-t pt-3.5">
          <p className="font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">Not today</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {plan.result.notToday.slice(0, 5).map((item, i) => {
              const Icon = SOURCE_STYLE[item.source].icon;
              return (
                <li key={i} className="flex gap-2 text-[0.8125rem] text-muted-foreground">
                  <Icon className="mt-0.5 size-3.25 shrink-0" />
                  <span className="min-w-0">
                    <b className="font-medium text-foreground">{item.title}</b> · {item.reason}
                  </span>
                </li>
              );
            })}
            {plan.result.notToday.length > 5 && (
              <li className="pl-5 text-xs text-muted-foreground">+{plan.result.notToday.length - 5} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={onAccept} disabled={accepting || kept.length === 0} className="cursor-pointer">
          <Check />
          {accepting ? "Adding…" : `Accept ${kept.length} block${kept.length === 1 ? "" : "s"}`}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={accepting} className="cursor-pointer">
          Discard plan
        </Button>
      </div>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.6875rem] text-muted-foreground">
        <i className="block size-1.5 rounded-full bg-success" />
        {plan.result.aiCalls} AI call{plan.result.aiCalls === 1 ? "" : "s"} · {(plan.result.ms / 1000).toFixed(1)}s
        {ownBlocks > 0 && ` · ${ownBlocks} yours`}
      </p>
    </Card>
  );
}

/* ---------------- Dialogs ---------------- */

function DialogHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 px-5.5 pt-5 pr-14">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-ring">
        <Sparkles className="size-4.5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[1.0625rem] leading-tight font-semibold">{title}</h2>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DialogFoot({ meta, children }: { meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4.5 flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-5.5 py-3.5">
      <span className="mr-auto font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">{meta}</span>
      {children}
    </div>
  );
}

const INCLUDE_ROWS: { key: keyof PlanInclude; source: PlanSource; label: string }[] = [
  { key: "followups", source: "followups", label: "due today" },
  { key: "learning", source: "learning", label: "next steps of active paths" },
  { key: "projects", source: "project", label: "active projects" },
  { key: "notes", source: "notes", label: "tagged #todo" },
  { key: "radar", source: "radar", label: "new items to read" },
];

export function PlanDialog({
  open,
  onOpenChange,
  date,
  freeSlots,
  onPlanned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  freeSlots: number;
  onPlanned: (result: DayPlanResult) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        {open && <PlanDialogBody date={date} freeSlots={freeSlots} onClose={() => onOpenChange(false)} onPlanned={onPlanned} />}
      </DialogContent>
    </Dialog>
  );
}

function PlanDialogBody({
  date,
  freeSlots,
  onClose,
  onPlanned,
}: {
  date: string;
  freeSlots: number;
  onClose: () => void;
  onPlanned: (result: DayPlanResult) => void;
}) {
  const [focus, setFocus] = useState("");
  const [include, setInclude] = useState<PlanInclude>({ followups: true, learning: true, projects: true, notes: true, radar: false });
  const [status, setStatus] = useState<"form" | "planning" | "error">("form");
  const [error, setError] = useState("");
  const counts = useQuery({
    queryKey: ["day-plan-counts", date],
    queryFn: async (): Promise<PlanCounts> => {
      const res = await fetch(`/api/ai/day-plan?date=${date}`);
      if (!res.ok) throw new Error("Failed to load counts");
      return res.json();
    },
    staleTime: 0,
  });

  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : 0;
  const selected = counts.data ? INCLUDE_ROWS.filter((r) => include[r.key]).reduce((sum, r) => sum + counts.data![r.key], 0) : 0;

  async function plan() {
    setStatus("planning");
    try {
      const res = await fetch("/api/ai/day-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, focus: focus.trim() || undefined, include }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "The AI didn't answer in time.");
      onPlanned(data as DayPlanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI didn't answer in time.");
      setStatus("error");
    }
  }

  if (freeSlots === 0) {
    return (
      <>
        <DialogHead title="Plan today with AI" description="Your day is already full." />
        <div className="px-5.5 pt-4">
          <div className="flex items-center gap-3 rounded-[14px] border border-dashed bg-background p-4">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-card text-ring">
              <Clock className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">All 8 blocks are filled</p>
              <p className="text-[0.8125rem] text-muted-foreground">Clear a block to let the AI plan it.</p>
            </div>
          </div>
        </div>
        <DialogFoot>
          <Button onClick={onClose} className="cursor-pointer">
            OK
          </Button>
        </DialogFoot>
      </>
    );
  }

  if (counts.data && total === 0) {
    return (
      <>
        <DialogHead title="Plan today with AI" description="Nothing to plan yet." />
        <div className="px-5.5 pt-4">
          <div className="rounded-[14px] border border-dashed bg-background px-4 py-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-card text-ring">
              <Sparkles className="size-4.5" />
            </span>
            <p className="mt-3 text-sm font-semibold">Nothing open to plan</p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              No follow-ups due, no active learning steps or projects. Add some, or fill your blocks yourself.
            </p>
            <div className="mt-3.5 flex justify-center gap-2">
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/jobs" />}>
                Open Jobs
              </Button>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/learning" />}>
                Open Learning
              </Button>
            </div>
          </div>
        </div>
        <DialogFoot>
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Close
          </Button>
        </DialogFoot>
      </>
    );
  }

  if (status === "planning") {
    return (
      <>
        <DialogHead title="Plan today with AI" description="Working on it…" />
        <div className="px-5.5 pt-4">
          <div className="flex flex-col gap-2.5 text-[0.8125rem]">
            <p className="flex items-center gap-2.5">
              <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success-strong">
                <Check className="size-3 stroke-[2.6]" />
              </span>
              Read {selected} open item{selected === 1 ? "" : "s"}
            </p>
            <p className="flex items-center gap-2.5">
              <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />
              Scoring priority and what fits today
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <span className="size-5 rounded-full border-[1.5px] border-input" />
              Placing them in your free blocks
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {[100, 100, 70].map((w, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <DialogFoot meta="Cancel stops the request">
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
        </DialogFoot>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <DialogHead title="Plan today with AI" description="Something went wrong." />
        <div className="px-5.5 pt-4">
          <p className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3 py-2.5 text-[0.8125rem] text-destructive-strong">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error} Nothing was changed.
          </p>
        </div>
        <DialogFoot>
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={plan} className="cursor-pointer">
            Try again
          </Button>
        </DialogFoot>
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void plan();
      }}
    >
      <DialogHead
        title="Plan today with AI"
        description={`Fills your ${freeSlots} free block${freeSlots === 1 ? "" : "s"}. Your own blocks stay.`}
      />
      <div className="px-5.5 pt-4">
        <label htmlFor="plan-focus" className="flex items-center text-[0.8125rem] font-medium">
          What matters most today?
          <span className="ml-auto text-xs font-normal text-muted-foreground">optional</span>
        </label>
        <Input
          id="plan-focus"
          autoFocus
          value={focus}
          maxLength={200}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="e.g. Finish the client site before the call"
          className="mt-1.5 text-[0.8125rem]"
        />
        <p className="mt-3.5 text-[0.8125rem] font-medium">Include</p>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {INCLUDE_ROWS.map((row) => {
            const count = counts.data?.[row.key];
            return (
              <label key={row.key} className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[0.8125rem] hover:bg-background">
                <Checkbox
                  checked={include[row.key] && count !== 0}
                  disabled={count === 0}
                  onCheckedChange={(checked) => setInclude((prev) => ({ ...prev, [row.key]: !!checked }))}
                />
                <SourceChip source={row.source} />
                <span className={cn(count === 0 && "text-muted-foreground")}>{row.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{counts.isPending ? "…" : count}</span>
              </label>
            );
          })}
        </div>
      </div>
      <DialogFoot meta={counts.data ? `${selected} open item${selected === 1 ? "" : "s"}` : undefined}>
        <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={counts.isPending || selected === 0} className="cursor-pointer">
          <Sparkles />
          Plan my day
        </Button>
      </DialogFoot>
    </form>
  );
}

export function SuggestionEditDialog({
  suggestion,
  edit,
  clockHour,
  onClose,
  onSave,
  onDrop,
}: {
  suggestion: PlanSuggestion | null;
  edit?: PlanEdit;
  clockHour: number;
  onClose: () => void;
  onSave: (edit: PlanEdit) => void;
  onDrop: () => void;
}) {
  return (
    <Dialog open={suggestion !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[440px]">
        {suggestion && (
          <EditBody key={suggestion.key} suggestion={suggestion} edit={edit} clockHour={clockHour} onSave={onSave} onDrop={onDrop} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditBody({
  suggestion,
  edit,
  clockHour,
  onSave,
  onDrop,
}: {
  suggestion: PlanSuggestion;
  edit?: PlanEdit;
  clockHour: number;
  onSave: (edit: PlanEdit) => void;
  onDrop: () => void;
}) {
  const [title, setTitle] = useState(edit?.title ?? suggestion.title);
  const [priority, setPriority] = useState<TimeBlock["priority"]>(edit?.priority ?? suggestion.priority);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title: title.trim(), priority });
      }}
    >
      <DialogHead
        title={`${hourLabel(clockHour)} – ${hourLabel(clockHour + 1)}`}
        description={`Suggested from ${SOURCE_LABEL[suggestion.source]}${suggestion.confidence !== null ? ` · ${percent(suggestion.confidence)}` : ""}`}
      />
      <div className="flex flex-col gap-3 px-5.5 pt-4">
        <div>
          <label htmlFor="plan-title" className="text-[0.8125rem] font-medium">
            Title
          </label>
          <Input id="plan-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
        </div>
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-medium">Priority</p>
          <SegmentedControl
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </div>
        <p className="rounded-xl bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <b className="font-medium text-foreground">Why here:</b> {suggestion.why}. {suggestion.whyHere}
        </p>
      </div>
      <DialogFoot>
        <Button type="button" variant="ghost" onClick={onDrop} className="cursor-pointer">
          Drop it
        </Button>
        <Button type="submit" disabled={!title.trim()} className="cursor-pointer">
          Keep with changes
        </Button>
      </DialogFoot>
    </form>
  );
}
