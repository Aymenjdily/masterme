"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { Note } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteDialog, EmptyState } from "@/components/ui-patterns/dialogs";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { NoteList } from "@/components/notes/NoteList";
import { isTyping, noteTitle, type NotesResponse } from "@/components/notes/note-utils";

const SEARCH_DEBOUNCE_MS = 250;

async function fetchNotes(q: string, tag: string | null, pinned: boolean): Promise<NotesResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  if (pinned) params.set("pinned", "true");
  const res = await fetch(`/api/notes?${params}`);
  if (!res.ok) throw new Error("Failed to load notes");
  return res.json();
}

/** The open note: `key` remounts the editor per note, `note` is null for a new, unsaved note. */
type OpenNote = { key: string; note: Note | null };

const setUrl = (id: string | null) => window.history.replaceState(null, "", id ? `/notes?id=${id}` : "/notes");

export function NotesView({ initialId }: { initialId: string | null }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [open, setOpen] = useState<OpenNote | null>(null);
  const [pendingInitial, setPendingInitial] = useState(initialId);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError } = useQuery({
    queryKey: [...queryKeys.notes, { query, tag, pinnedOnly }],
    queryFn: () => fetchNotes(query, tag, pinnedOnly),
    placeholderData: keepPreviousData,
  });

  // Open the note from ?id= once the list has loaded.
  if (pendingInitial && data) {
    setPendingInitial(null);
    const note = data.notes.find((n) => n.id === pendingInitial);
    if (note) setOpen({ key: note.id, note });
  }

  const openNote = (note: Note) => {
    setOpen({ key: note.id, note });
    setUrl(note.id);
  };

  const newNote = useCallback(() => {
    setOpen({ key: crypto.randomUUID(), note: null });
    setUrl(null);
  }, []);

  const closeNote = useCallback(() => {
    setOpen(null);
    setUrl(null);
  }, []);

  const onSaved = useCallback(
    (note: Note, created: boolean) => {
      if (created) {
        setOpen((current) => (current ? { ...current, note } : current));
        setUrl(note.id);
      }
      // Show the edit in the list right away, then refetch for order, groups and tag counts.
      queryClient.setQueriesData<NotesResponse>({ queryKey: queryKeys.notes }, (old) =>
        old ? { ...old, notes: old.notes.map((n) => (n.id === note.id ? note : n)) } : old
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
    [queryClient]
  );

  const deleteMutation = useMutation({
    mutationFn: async (note: Note) => {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
    },
    onSuccess: (_data, note) => {
      setDeleting(null);
      if (open?.note?.id === note.id) closeNote();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    },
  });

  // "/" focuses search, "N" starts a new note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        newNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newNote]);

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setTag(null);
    setPinnedOnly(false);
  };

  const empty = data?.total === 0 && !open;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ideas, meeting notes and things to remember, all in one place.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-input bg-card px-3 text-muted-foreground focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/20 sm:w-75 sm:flex-none">
            <Search className="size-3.75 shrink-0" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setSearch(""), e.currentTarget.blur())}
              placeholder="Search notes…"
              aria-label="Search notes"
              maxLength={100}
              className="min-w-0 flex-1 bg-transparent text-[0.84375rem] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-[5px] bg-muted px-1.5 py-px font-mono text-[0.6875rem] font-medium sm:inline">/</kbd>
          </label>
          <Button onClick={newNote} className="cursor-pointer">
            <Plus />
            New note
            <kbd className="ml-0.5 hidden rounded-[5px] bg-card/50 px-1.25 py-px font-mono text-[0.6875rem] font-medium text-warning-strong sm:inline">
              N
            </kbd>
          </Button>
        </div>
      </div>

      {empty ? (
        <div className="mt-5.5">
          <EmptyState
            icon={StickyNote}
            title="No notes yet"
            description="Write down ideas, meeting notes and anything you want to remember. They stay private to your account."
            actionLabel="New note"
            primary
            onAction={newNote}
          />
        </div>
      ) : (
        <div className="mt-5.5 grid gap-4 lg:h-[calc(100svh-14.5rem)] lg:min-h-130 lg:grid-cols-[372px_1fr]">
          <NoteList
            data={data}
            loading={isPending}
            failed={isError}
            query={query}
            tag={tag}
            pinnedOnly={pinnedOnly}
            selectedId={open?.note?.id ?? null}
            className={cn(open && "max-lg:hidden")}
            onTag={setTag}
            onPinnedOnly={setPinnedOnly}
            onClearFilters={clearFilters}
            onOpen={openNote}
          />
          {open ? (
            <NoteEditor
              key={open.key}
              note={open.note}
              allTags={data?.tags ?? []}
              className="max-lg:min-h-[75svh]"
              onSaved={onSaved}
              onDelete={(note) => (note ? setDeleting(note) : closeNote())}
              onBack={closeNote}
            />
          ) : (
            <Card className="hidden items-center justify-center rounded-[20px] text-center lg:flex">
              <div className="flex size-11 items-center justify-center rounded-xl border bg-background">
                <StickyNote className="size-[18px] text-ring" />
              </div>
              <div>
                <p className="text-sm font-semibold">Pick a note to read or edit it</p>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                  Or press <kbd className="font-mono text-foreground">N</kbd> to start a new one.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      <DeleteDialog
        name={deleting ? `“${noteTitle(deleting)}”` : ""}
        open={deleting !== null}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setDeleting(null);
          deleteMutation.reset();
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
