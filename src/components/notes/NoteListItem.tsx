"use client";

import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { notePreview, noteTitle, shortDate, tagTone } from "@/components/notes/note-utils";

export function NoteListItem({
  note,
  selected,
  onOpen,
}: {
  note: Note;
  selected: boolean;
  onOpen: (note: Note) => void;
}) {
  const preview = notePreview(note);

  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      aria-current={selected || undefined}
      className={cn(
        "relative block w-full cursor-pointer rounded-[14px] border border-transparent py-2.75 pr-3 pl-3.5 text-left transition-colors hover:bg-background max-lg:border-border max-lg:bg-card",
        selected &&
          "border-border bg-background before:absolute before:top-3.5 before:bottom-3.5 before:left-0 before:w-[3px] before:rounded-r-[3px] before:bg-primary"
      )}
    >
      <p className="flex items-center gap-1.5 truncate text-[0.84375rem] font-semibold">
        {note.pinned && <Pin className="size-3 shrink-0 fill-primary/35 text-ring" />}
        <span className="truncate">{noteTitle(note)}</span>
      </p>
      {preview && (
        <p className="mt-0.75 line-clamp-2 text-[0.78125rem] leading-normal text-muted-foreground">{preview}</p>
      )}
      <div className="mt-2 flex items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
        {note.tags.slice(0, 3).map((tag) => (
          <span key={tag} className={cn("inline-flex h-5 items-center rounded-md px-1.75 text-[0.65625rem] font-medium", tagTone(tag))}>
            #{tag}
          </span>
        ))}
        <span className="ml-auto">{shortDate(note.updatedAt)}</span>
      </div>
    </button>
  );
}
