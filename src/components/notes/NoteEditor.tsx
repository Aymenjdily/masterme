"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Pin, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTE_BODY_MAX } from "@/lib/validations";
import type { Note } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TagPicker } from "@/components/notes/TagPicker";
import {
  EMPTY_DRAFT,
  editedLabel,
  dayLabel,
  tagTone,
  toDraft,
  wordCount,
  type NoteDraft,
} from "@/components/notes/note-utils";

const AUTOSAVE_MS = 800;
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const snapshot = (draft: NoteDraft) => JSON.stringify(draft);
const isBlank = (draft: NoteDraft) => !draft.title.trim() && !draft.body.trim() && draft.tags.length === 0;

/**
 * Edits one note and saves it 800 ms after typing stops, on blur and on Ctrl/⌘ S.
 * A new note (`note` is null) is only created on the first real change. Mount with a `key` per opened note.
 */
export function NoteEditor({
  note,
  allTags,
  className,
  onSaved,
  onDelete,
  onBack,
}: {
  note: Note | null;
  allTags: { name: string; count: number }[];
  className?: string;
  onSaved: (note: Note, created: boolean) => void;
  onDelete: (note: Note | null) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<NoteDraft>(() => (note ? toDraft(note) : EMPTY_DRAFT));
  const [saved, setSaved] = useState<Note | null>(note);
  const [state, setState] = useState<SaveState>(note ? "saved" : "idle");

  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  const lastSaved = useRef(snapshot(draft));
  const busy = useRef(false);
  const again = useRef(false);
  const discarded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  // Reads only refs, so any render's copy saves the latest draft.
  const save = async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (discarded.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    const current = draftRef.current;
    const snap = snapshot(current);
    if (snap === lastSaved.current) {
      setState(savedRef.current ? "saved" : "idle");
      return;
    }
    const id = savedRef.current?.id;
    if (!id && isBlank(current)) return;

    busy.current = true;
    setState("saving");
    try {
      const res = await fetch(id ? `/api/notes/${id}` : "/api/notes", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(current),
        keepalive: true,
      });
      if (!res.ok) throw new Error("Save failed");
      const result: Note = await res.json();
      lastSaved.current = snap;
      savedRef.current = result;
      setSaved(result);
      onSavedRef.current(result, !id);
      setState(snapshot(draftRef.current) === snap ? "saved" : "pending");
    } catch {
      setState("error");
      again.current = false;
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void saveRef.current?.();
      }
    }
  };
  const saveRef = useRef<typeof save>(null);
  useEffect(() => {
    saveRef.current = save;
  });

  // Leaving the note (switching, back, closing the page) saves what's left.
  useEffect(() => () => void saveRef.current?.(), []);

  const update = (patch: Partial<NoteDraft>, immediate = false) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setState("pending");
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void save();
    else timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  };

  const remove = () => {
    if (!savedRef.current) {
      // A new note that was never saved is simply discarded.
      discarded.current = true;
      onDelete(null);
      return;
    }
    onDelete(savedRef.current);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys from the tag popover bubble here through the portal; leave those to the popover.
    if (!e.currentTarget.contains(e.target as Node)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape" && !e.defaultPrevented) {
      void save();
      onBack();
    }
  };

  const words = wordCount(draft.body);

  return (
    <Card className={cn("min-h-0 gap-0 rounded-[20px] py-0", className)} onKeyDown={onKeyDown}>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3.5">
        <Button variant="ghost" size="icon-sm" onClick={onBack} className="-ml-1.5 cursor-pointer lg:hidden" aria-label="Back to notes">
          <ChevronLeft />
        </Button>
        {draft.tags.map((tag) => (
          <span key={tag} className={cn("inline-flex h-6 items-center gap-1 rounded-full pr-1.5 pl-2.25 font-mono text-[0.71875rem] font-medium", tagTone(tag))}>
            #{tag}
            <button
              type="button"
              onClick={() => update({ tags: draft.tags.filter((t) => t !== tag) }, true)}
              className="cursor-pointer opacity-60 hover:opacity-100"
              aria-label={`Remove #${tag}`}
            >
              <X className="size-2.75" />
            </button>
          </span>
        ))}
        <TagPicker value={draft.tags} allTags={allTags} onAdd={(tag) => update({ tags: [...draft.tags, tag] }, true)} />

        <span className="ml-auto flex items-center gap-1.5 font-mono text-xs">
          {state === "saved" && (
            <span className="flex items-center gap-1.5 text-success-strong">
              <Check className="size-3.25" />
              Saved
            </span>
          )}
          {(state === "saving" || state === "pending") && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <i className="size-1.5 rounded-full bg-primary ring-3 ring-primary/20" />
              Saving…
            </span>
          )}
          {state === "error" && (
            <button type="button" onClick={() => void save()} className="cursor-pointer text-destructive-strong hover:underline">
              Not saved · Retry
            </button>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-pressed={draft.pinned}
          aria-label={draft.pinned ? "Unpin" : "Pin"}
          title={draft.pinned ? "Unpin" : "Pin"}
          onClick={() => update({ pinned: !draft.pinned }, true)}
          className={cn(
            "cursor-pointer border text-muted-foreground",
            draft.pinned ? "border-primary/35 bg-primary/12 text-ring hover:bg-primary/20 [&_svg]:fill-primary/35" : "border-transparent"
          )}
        >
          <Pin />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete note"
          title="Delete"
          onClick={remove}
          className="cursor-pointer text-muted-foreground hover:text-destructive-strong"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6.5 pb-5 sm:px-8">
        <input
          value={draft.title}
          maxLength={200}
          autoFocus={!note}
          onChange={(e) => update({ title: e.target.value })}
          onBlur={() => void save()}
          placeholder="Untitled note"
          aria-label="Title"
          className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <p className="mt-2 flex flex-wrap gap-x-3.5 font-mono text-xs text-muted-foreground">
          {saved ? (
            <>
              <span>Created {dayLabel(saved.createdAt)}</span>
              <span>·</span>
              <span>Edited {editedLabel(saved.updatedAt)}</span>
            </>
          ) : (
            <span>New · not saved yet</span>
          )}
          <span>·</span>
          <span>
            {words} word{words === 1 ? "" : "s"}
          </span>
        </p>
        <textarea
          value={draft.body}
          maxLength={NOTE_BODY_MAX}
          onChange={(e) => update({ body: e.target.value })}
          onBlur={() => void save()}
          placeholder="Start writing…"
          aria-label="Note"
          className="mt-5 min-h-60 w-full max-w-170 flex-1 resize-none bg-transparent text-[0.90625rem] leading-[1.75] text-foreground/90 outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="flex items-center gap-3.5 border-t px-4.5 py-3 font-mono text-[0.71875rem] text-muted-foreground">
        <span>Plain text · autosaves as you type</span>
        <span className="ml-auto hidden sm:inline">
          <b className="font-medium text-foreground">Esc</b> back to list · <b className="font-medium text-foreground">Ctrl S</b> save now
        </span>
      </div>
    </Card>
  );
}
