"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pin, Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { showToast } from "@/components/ai/Toast";
import { hourLabel } from "@/components/timeline/WakeUpPrompt";

// "From your notes": #todo notes offered as tasks for this day. Adding one is by hand, no AI.

type NoteTask = { id: string; title: string; preview: string; pinned: boolean };
type NoteTasksResponse = { notes: NoteTask[]; total: number; todoTotal: number };

export type FreeHour = { slot: number; clockHour: number };

async function fetchNoteTasks(date: string): Promise<NoteTasksResponse> {
  const res = await fetch(`/api/timeline/note-tasks?date=${date}`);
  if (!res.ok) throw new Error("Failed to load notes");
  return res.json();
}

export function NoteTasksCard({
  date,
  freeHours,
  nextSlot,
  onChanged,
}: {
  date: string;
  /** Free hours of the day, in order */
  freeHours: FreeHour[];
  /** The free slot to suggest first (e.g. the next one from now) */
  nextSlot: number | null;
  /** Refresh the timeline after a block was added or undone */
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.noteTasks(date),
    queryFn: () => fetchNoteTasks(date),
  });
  const [adding, setAdding] = useState<string | null>(null);

  const refresh = () => {
    onChanged();
    void queryClient.invalidateQueries({ queryKey: ["note-tasks"] });
  };

  async function add(note: NoteTask, hour: FreeHour) {
    setAdding(note.id);
    try {
      const res = await fetch("/api/timeline/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          hour: hour.slot,
          title: note.title,
          description: `From your note “${note.title}”`.slice(0, 200),
          priority: "medium",
          status: "planned",
          noteId: note.id,
        }),
      });
      if (res.status === 409) {
        showToast({ title: "That hour was just taken", detail: "Pick another free hour." });
        return;
      }
      if (!res.ok) throw new Error("Failed to add");
      const block: { id: string } = await res.json();
      showToast({
        title: `Added to ${hourLabel(hour.clockHour)}`,
        detail: note.title,
        onUndo: async () => {
          const undo = await fetch(`/api/timeline/blocks/${block.id}`, { method: "DELETE" });
          if (!undo.ok && undo.status !== 404) throw new Error("Undo failed");
          refresh();
        },
      });
    } catch {
      showToast({ title: "Couldn't add the note. Please try again." });
    } finally {
      setAdding(null);
      refresh();
    }
  }

  const notes = data?.notes ?? [];
  const more = (data?.total ?? 0) - notes.length;
  const full = freeHours.length === 0;

  return (
    <Card className="gap-0 rounded-[20px] px-4 pt-4.5 pb-3.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          <StickyNote className="size-4 text-ring" />
          From your notes
        </h2>
        {!!data?.total && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">{data.total}</span>
        )}
      </div>

      {isPending && (
        <div className="mt-3 flex flex-col gap-1.5">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}
      {isError && <p className="mt-3 px-1 text-[0.8125rem] text-destructive-strong">Failed to load your notes.</p>}

      {data && data.total === 0 && data.todoTotal > 0 && (
        <p className="mx-1 mt-1.5 text-[0.78125rem] leading-normal text-muted-foreground">
          All set: your #todo notes are on this day or already done.{" "}
          <Link href="/notes?tag=todo" className="font-medium text-info-strong hover:underline">
            Open in Notes
          </Link>
        </p>
      )}

      {data && data.todoTotal === 0 && (
        <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-input bg-background px-3.5 py-4.5 text-center">
          <p className="text-[0.8125rem] font-semibold">No #todo notes</p>
          <p className="mt-0.75 text-xs leading-normal text-muted-foreground">
            Tag a note <span className="font-mono text-foreground">#todo</span> in Notes and it shows up here as a task.
          </p>
          <Button size="xs" variant="outline" nativeButton={false} render={<Link href="/notes" />} className="mt-2.5 h-7 cursor-pointer px-2.5">
            <StickyNote />
            Open Notes
          </Button>
        </div>
      )}

      {notes.length > 0 && (
        <>
          <p className="mx-1 mt-1 mb-2.5 text-[0.78125rem] leading-normal text-muted-foreground">
            {full ? (
              "All 8 hours are filled. Clear a block to add a note."
            ) : (
              <>
                Notes tagged <span className="font-mono text-foreground">#todo</span>. Add one to a free hour.
              </>
            )}
          </p>
          <ul className="flex flex-col gap-1.5">
            {notes.map((note) => (
              <li key={note.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-xl border py-2.5 pr-2.5 pl-3 hover:bg-background">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium">
                    {note.pinned && <Pin className="size-2.75 shrink-0 fill-primary/35 text-ring" />}
                    <span className="truncate">{note.title}</span>
                  </p>
                  {note.preview && <p className="mt-0.5 truncate text-[0.71875rem] text-muted-foreground">{note.preview}</p>}
                </div>
                <HourPicker
                  disabled={full || adding !== null}
                  busy={adding === note.id}
                  freeHours={freeHours}
                  nextSlot={nextSlot}
                  label={note.title}
                  onPick={(hour) => void add(note, hour)}
                />
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between border-t px-1 pt-2.5 text-xs text-muted-foreground">
            <span>{more > 0 ? `${more} more` : ""}</span>
            <Link href="/notes?tag=todo" className="inline-flex items-center gap-1 font-medium text-info-strong hover:underline">
              Open in Notes
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

function HourPicker({
  disabled,
  busy,
  freeHours,
  nextSlot,
  label,
  onPick,
}: {
  disabled: boolean;
  busy: boolean;
  freeHours: FreeHour[];
  nextSlot: number | null;
  label: string;
  onPick: (hour: FreeHour) => void;
}) {
  const [open, setOpen] = useState(false);
  const last = freeHours[freeHours.length - 1]?.slot;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={`Add “${label}” to a free hour`}
        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-input bg-card px-2.25 text-xs font-medium whitespace-nowrap shadow-xs outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-45 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/20"
      >
        <Plus className="size-3" />
        {busy ? "Adding…" : "Add"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-49 p-1.5">
        <p className="px-2 pt-1.5 pb-1 font-mono text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">Free hours</p>
        {freeHours.map((hour) => (
          <button
            key={hour.slot}
            type="button"
            onClick={() => {
              setOpen(false);
              onPick(hour);
            }}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.75 font-mono text-[0.78125rem] font-medium hover:bg-background",
              hour.slot === nextSlot && "bg-background"
            )}
          >
            {hourLabel(hour.clockHour)}
            <span className="font-sans text-[0.71875rem] font-normal text-muted-foreground">
              {hour.slot === nextSlot ? "next free" : hour.slot === last ? "last" : ""}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
