"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Sparkles, Sunrise } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { useLocalNow } from "@/hooks/use-local-now";
import type { TimeBlock, Timeline } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog, FormDialog } from "@/components/ui-patterns/dialogs";
import { TimelineForm } from "@/components/forms/TimelineForm";
import { DayProgress } from "@/components/timeline/DayProgress";
import { NEXT_BLOCK_STATUS, TimeBlockSlot } from "@/components/timeline/TimeBlockSlot";
import { WakeUpPicker, WakeUpPrompt, hourLabel } from "@/components/timeline/WakeUpPrompt";
import {
  BufferSlot,
  PlanBanner,
  PlanDialog,
  PlanPanel,
  SuggestionEditDialog,
  SuggestionSlot,
  keptSuggestions,
  type PlanState,
} from "@/components/ai/DayPlanner";
import { recordOutcome } from "@/components/ai/PasteAnything";
import { showToast } from "@/components/ai/Toast";

type TimelineResponse = { timeline: Timeline | null };

async function fetchTimeline(date: string): Promise<TimelineResponse> {
  const res = await fetch(`/api/timeline?date=${date}`);
  if (!res.ok) throw new Error("Failed to load timeline");
  return res.json();
}

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Fixed locale + UTC so server and client render the same string.
function longDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function TimelineView({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.timeline(date);
  const [editingWakeUp, setEditingWakeUp] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ slot: number; block?: TimeBlock } | null>(null);
  const [clearing, setClearing] = useState<TimeBlock | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planState, setPlanState] = useState<(PlanState & { date: string }) | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const plan = planState?.date === date ? planState : null;

  const { day: localDay, hour: localHour } = useLocalNow();

  const { data, isPending, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchTimeline(date),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const statusMutation = useMutation({
    mutationFn: ({ block, status }: { block: TimeBlock; status: TimeBlock["status"] }) =>
      request(`/api/timeline/blocks/${block.id}`, "PATCH", { status }),
    onMutate: async ({ block, status }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TimelineResponse>(key);
      queryClient.setQueryData<TimelineResponse>(key, (old) =>
        old?.timeline
          ? {
              timeline: {
                ...old.timeline,
                blocks: old.timeline.blocks.map((b) => (b.id === block.id ? { ...b, status } : b)),
              },
            }
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(key, context?.previous),
    onSettled: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ block, direction }: { block: TimeBlock; direction: "up" | "down" }) =>
      request(`/api/timeline/blocks/${block.id}/reorder`, "POST", { direction }),
    onSettled: invalidate,
  });

  const clearMutation = useMutation({
    mutationFn: (block: TimeBlock) => request(`/api/timeline/blocks/${block.id}`, "DELETE"),
    onSuccess: () => {
      setClearing(null);
      invalidate();
    },
  });

  const timeline = data?.timeline ?? null;
  const blocks = timeline?.blocks ?? [];
  const wakeUpHour = timeline?.wakeUpHour ?? null;
  const isToday = localDay === date;

  const nowSlot =
    isToday && wakeUpHour != null
      ? Array.from({ length: 8 }, (_, slot) => slot).find((slot) => (wakeUpHour + slot) % 24 === localHour)
      : undefined;
  const nowBlock = nowSlot !== undefined ? blocks.find((b) => b.hour === nowSlot) : undefined;

  const goTo = (target: string) => router.push(`/timeline?date=${target}`);
  const freeSlots = 8 - blocks.length;
  const planEvents = plan ? [plan.result.decisionEventId, plan.result.namingEventId] : [];
  const editingSuggestion = plan?.result.suggestions.find((s) => s.key === editingKey) ?? null;

  function discardPlan() {
    for (const id of planEvents) recordOutcome(id, "rejected");
    setPlanState(null);
  }

  function updatePlan(change: (plan: PlanState) => Partial<PlanState>) {
    setPlanState((prev) => (prev ? { ...prev, ...change(prev) } : prev));
  }

  async function acceptPlan() {
    if (!plan) return;
    setAccepting(true);
    try {
      // Re-read the day: a slot filled since planning is skipped, never overwritten.
      const fresh = await queryClient.fetchQuery({ queryKey: key, queryFn: () => fetchTimeline(date), staleTime: 0 });
      const takenNow = new Set((fresh.timeline?.blocks ?? []).map((b) => b.hour));
      const kept = keptSuggestions(plan);
      const toCreate = kept.filter((s) => !takenNow.has(s.slot));
      const created: string[] = [];
      for (const s of toCreate) {
        const block = await request("/api/timeline/blocks", "POST", {
          date,
          hour: s.slot,
          title: s.title,
          description: s.description ?? undefined,
          priority: s.priority,
          status: "planned",
        });
        created.push(block.id);
      }
      const changed = plan.dropped.size > 0 || Object.keys(plan.edits).length > 0;
      for (const id of planEvents) recordOutcome(id, changed ? "edited" : "accepted");
      setPlanState(null);
      invalidate();
      const skipped = kept.length - toCreate.length;
      const weekday = new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
      showToast({
        title: `${created.length} block${created.length === 1 ? "" : "s"} added`,
        detail: `to ${weekday}${skipped ? ` · ${skipped} skipped, slot taken` : ""}`,
        onUndo: async () => {
          for (const id of created) {
            const res = await fetch(`/api/timeline/blocks/${id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 404) throw new Error("Undo failed");
          }
          for (const id of planEvents) recordOutcome(id, "rejected");
          invalidate();
        },
      });
    } catch {
      showToast({ title: "Couldn't add the blocks. Please try again." });
      invalidate();
    } finally {
      setAccepting(false);
    }
  }
  const dialogClock = blockDialog && wakeUpHour != null ? wakeUpHour + blockDialog.slot : 0;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Timeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan your day in 8 one-hour blocks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wakeUpHour != null && !plan && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlanOpen(true)}
              className="h-9 cursor-pointer border-ring/50 ring-3 ring-primary/15"
            >
              <Sparkles className="text-ring" />
              Plan with AI
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={date === today}
            onClick={() => router.push("/timeline")}
            className="h-9 cursor-pointer"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => goTo(shiftDate(date, -1))}
            className="size-9 cursor-pointer text-muted-foreground"
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-44 text-center sm:min-w-52">
            <p className="text-sm font-semibold">{longDate(date)}</p>
            <p className="font-mono text-[0.6875rem] text-muted-foreground">{date}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => goTo(shiftDate(date, 1))}
            className="size-9 cursor-pointer text-muted-foreground"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="mt-5.5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
          <Skeleton className="h-130 rounded-[20px]" />
          <Skeleton className="h-100 rounded-[20px]" />
        </div>
      )}

      {isError && <p className="mt-5.5 text-sm text-destructive-strong">Failed to load timeline.</p>}

      {!isPending && !isError && wakeUpHour == null && <WakeUpPrompt date={date} longDate={longDate(date)} />}

      {!isPending && !isError && wakeUpHour != null && plan && (
        <PlanBanner
          plan={plan}
          accepting={accepting}
          onDiscard={discardPlan}
          onReplan={() => {
            discardPlan();
            setPlanOpen(true);
          }}
          onAccept={acceptPlan}
        />
      )}

      {!isPending && !isError && wakeUpHour != null && (
        <div className="mt-5.5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="gap-3.5 rounded-[20px] px-4 sm:px-5.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[0.9375rem] font-semibold">Your day</h2>
              <button
                type="button"
                onClick={() => setEditingWakeUp(true)}
                className="inline-flex h-7.5 cursor-pointer items-center gap-2 rounded-lg border bg-background px-2.5 font-mono text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <Sunrise className="size-3.5" />
                Wake up <span className="font-medium text-foreground">{hourLabel(wakeUpHour)}</span>
                <Pencil className="size-3.5" />
              </button>
            </div>

            <ol>
              {Array.from({ length: 8 }, (_, slot) => {
                const block = blocks.find((b) => b.hour === slot);
                const suggestion = !block ? plan?.result.suggestions.find((s) => s.slot === slot) : undefined;
                if (suggestion && plan) {
                  return (
                    <SuggestionSlot
                      key={slot}
                      clockHour={wakeUpHour + slot}
                      suggestion={suggestion}
                      edit={plan.edits[suggestion.key]}
                      dropped={plan.dropped.has(suggestion.key)}
                      isFirst={slot === 0}
                      isLast={slot === 7}
                      onToggle={() =>
                        updatePlan((p) => {
                          const dropped = new Set(p.dropped);
                          if (dropped.has(suggestion.key)) dropped.delete(suggestion.key);
                          else dropped.add(suggestion.key);
                          return { dropped };
                        })
                      }
                      onEdit={() => setEditingKey(suggestion.key)}
                    />
                  );
                }
                if (!block && plan && plan.result.bufferSlot === slot) {
                  return (
                    <BufferSlot
                      key={slot}
                      clockHour={wakeUpHour + slot}
                      isFirst={slot === 0}
                      isLast={slot === 7}
                      onAdd={() => setBlockDialog({ slot })}
                    />
                  );
                }
                return (
                <TimeBlockSlot
                  key={slot}
                  tag={plan && block ? "yours" : undefined}
                  clockHour={wakeUpHour + slot}
                  block={block}
                  isNow={slot === nowSlot}
                  isFirst={slot === 0}
                  isLast={slot === 7}
                  moving={moveMutation.isPending}
                  onAdd={() => setBlockDialog({ slot })}
                  onEdit={(block) => setBlockDialog({ slot, block })}
                  onClear={(block) => setClearing(block)}
                  onCycle={(block) => statusMutation.mutate({ block, status: NEXT_BLOCK_STATUS[block.status] })}
                  onMove={(block, direction) => moveMutation.mutate({ block, direction })}
                />
                );
              })}
            </ol>
          </Card>

          {plan ? (
            <PlanPanel plan={plan} ownBlocks={blocks.length} accepting={accepting} onAccept={acceptPlan} onDiscard={discardPlan} />
          ) : (
            <DayProgress
              blocks={blocks}
              now={nowBlock && nowSlot !== undefined ? { block: nowBlock, clockHour: wakeUpHour + nowSlot } : null}
            />
          )}
        </div>
      )}

      <FormDialog
        open={blockDialog !== null}
        onOpenChange={(open) => !open && setBlockDialog(null)}
        title={blockDialog?.block ? "Edit task" : "Add task"}
        description={`${hourLabel(dialogClock)} – ${hourLabel(dialogClock + 1)} · ${longDate(date)}`}
      >
        {blockDialog !== null && (
          <TimelineForm
            key={blockDialog.block?.id ?? `slot-${blockDialog.slot}`}
            date={date}
            hour={blockDialog.slot}
            block={blockDialog.block}
            onDone={() => setBlockDialog(null)}
          />
        )}
      </FormDialog>

      <PlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        date={date}
        freeSlots={freeSlots}
        onPlanned={(result) => {
          setPlanOpen(false);
          setPlanState({ date, result, dropped: new Set(), edits: {} });
        }}
      />

      <SuggestionEditDialog
        suggestion={editingSuggestion}
        edit={editingSuggestion ? plan?.edits[editingSuggestion.key] : undefined}
        clockHour={editingSuggestion && wakeUpHour != null ? wakeUpHour + editingSuggestion.slot : 0}
        onClose={() => setEditingKey(null)}
        onSave={(edit) => {
          if (editingSuggestion) {
            const unchanged = edit.title === editingSuggestion.title && edit.priority === editingSuggestion.priority;
            updatePlan((p) => {
              const edits = { ...p.edits };
              if (unchanged) delete edits[editingSuggestion.key];
              else edits[editingSuggestion.key] = edit;
              return { edits };
            });
          }
          setEditingKey(null);
        }}
        onDrop={() => {
          if (editingSuggestion) updatePlan((p) => ({ dropped: new Set(p.dropped).add(editingSuggestion.key) }));
          setEditingKey(null);
        }}
      />

      <FormDialog
        open={editingWakeUp}
        onOpenChange={setEditingWakeUp}
        title="Change wake-up hour"
        description="Your 8 blocks keep their slots and move with the new start time."
      >
        {editingWakeUp && (
          <div className="px-6 pb-6">
            <WakeUpPicker
              date={date}
              defaultHour={wakeUpHour ?? 7}
              submitLabel="Save"
              onSaved={() => setEditingWakeUp(false)}
              onCancel={() => setEditingWakeUp(false)}
            />
          </div>
        )}
      </FormDialog>

      <DeleteDialog
        name={clearing?.title ?? ""}
        open={clearing !== null}
        pending={clearMutation.isPending}
        failed={clearMutation.isError}
        onCancel={() => {
          setClearing(null);
          clearMutation.reset();
        }}
        onConfirm={() => clearing && clearMutation.mutate(clearing)}
      />
    </div>
  );
}
