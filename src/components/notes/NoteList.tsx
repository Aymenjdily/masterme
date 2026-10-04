"use client";

import { Pin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NoteListItem } from "@/components/notes/NoteListItem";
import { groupNotes, type NotesResponse } from "@/components/notes/note-utils";

export function NoteList({
  data,
  loading,
  failed,
  query,
  tag,
  pinnedOnly,
  selectedId,
  className,
  onTag,
  onPinnedOnly,
  onClearFilters,
  onOpen,
}: {
  data: NotesResponse | undefined;
  loading: boolean;
  failed: boolean;
  query: string;
  tag: string | null;
  pinnedOnly: boolean;
  selectedId: string | null;
  className?: string;
  onTag: (tag: string | null) => void;
  onPinnedOnly: (pinned: boolean) => void;
  onClearFilters: () => void;
  onOpen: (note: Note) => void;
}) {
  const notes = data?.notes ?? [];
  const filtered = !!query || !!tag || pinnedOnly;

  return (
    <Card className={cn("min-h-0 gap-0 rounded-[20px] px-3 py-3.5", className)}>
      <div className="flex items-center justify-between px-1.5 pt-0.5 pb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[0.9375rem] font-semibold">All notes</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
            {data?.total ?? 0}
          </span>
        </div>
        <div role="radiogroup" aria-label="Show" className="inline-flex gap-0.5 rounded-[9px] bg-muted p-[3px]">
          {[
            { value: false, label: "All" },
            { value: true, label: "Pinned" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={pinnedOnly === option.value}
              onClick={() => onPinnedOnly(option.value)}
              className={cn(
                "flex h-6.5 cursor-pointer items-center gap-1.25 rounded-[7px] px-2.5 text-xs font-medium text-muted-foreground",
                pinnedOnly === option.value && "bg-card text-foreground shadow-xs"
              )}
            >
              {option.value && <Pin className="size-3" />}
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!!data?.tags.length && (
        <div className="flex flex-wrap gap-1.5 border-b px-1.5 pb-3">
          <TagChip active={tag === null} onClick={() => onTag(null)}>
            all
          </TagChip>
          {data.tags.map((t) => (
            <TagChip key={t.name} active={tag === t.name} onClick={() => onTag(tag === t.name ? null : t.name)}>
              #{t.name} <small className="text-[0.65625rem] opacity-70">{t.count}</small>
            </TagChip>
          ))}
        </div>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-color:var(--input)_transparent] [scrollbar-width:thin]">
        {loading && (
          <div className="flex flex-col gap-2 pt-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-21 rounded-[14px]" />
            ))}
          </div>
        )}
        {failed && <p className="px-2 pt-4 text-sm text-destructive-strong">Failed to load your notes.</p>}

        {!loading && !failed && notes.length === 0 && filtered && (
          <div className="mt-3 flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-5 py-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
              <Search className="size-[18px] text-ring" />
            </div>
            <p className="mt-3.5 text-sm font-semibold">
              {query ? <>No notes match &ldquo;{query}&rdquo;</> : "No notes here"}
            </p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              {tag ? (
                <>
                  Try a different word, or clear the tag filter{" "}
                  <span className="font-mono text-foreground">#{tag}</span>.
                </>
              ) : pinnedOnly ? (
                "Pin a note to keep it at the top."
              ) : (
                "Try a different word."
              )}
            </p>
            <Button size="sm" variant="outline" onClick={onClearFilters} className="mt-4 cursor-pointer">
              <X />
              Clear filters
            </Button>
          </div>
        )}

        {groupNotes(notes).map((group) => (
          <section key={group.label}>
            <h3 className="flex items-center gap-1.5 px-2 pt-3.5 pb-1.5 font-mono text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
              {group.pinned && <Pin className="size-2.75" />}
              {group.label}
            </h3>
            <div className="flex flex-col gap-0.5 max-lg:gap-2">
              {group.notes.map((note) => (
                <NoteListItem key={note.id} note={note} selected={note.id === selectedId} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function TagChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 cursor-pointer items-center gap-1.25 rounded-full border border-input bg-card px-2.25 font-mono text-[0.71875rem] font-medium text-muted-foreground hover:text-foreground",
        active && "border-foreground bg-foreground text-background hover:text-background"
      )}
    >
      {children}
    </button>
  );
}
