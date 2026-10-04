import type { Note } from "@/types";

export interface NotesResponse {
  notes: Note[];
  tags: { name: string; count: number }[];
  total: number;
}

export interface NoteDraft {
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
}

export const EMPTY_DRAFT: NoteDraft = { title: "", body: "", tags: [], pinned: false };

export const toDraft = (note: Note): NoteDraft => ({
  title: note.title,
  body: note.body,
  tags: note.tags,
  pinned: note.pinned,
});

/** An untitled note shows its first line in the list. */
export function noteTitle(note: Pick<Note, "title" | "body">) {
  return note.title.trim() || note.body.trim().split("\n")[0]?.slice(0, 80) || "Untitled note";
}

export function notePreview(note: Pick<Note, "title" | "body">) {
  const body = note.body.trim();
  // Skip the first line when it already stands in for the title.
  const text = note.title.trim() ? body : body.split("\n").slice(1).join(" ");
  return text.replace(/\s+/g, " ").trim();
}

export function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "14:32" today, "Oct 2" this year, "Oct 2, 2025" before. */
export function shortDate(value: string) {
  const d = new Date(value);
  const now = new Date();
  if (isSameDay(d, now)) return time(d);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "today" or "Oct 2". */
export function dayLabel(value: string) {
  return isSameDay(new Date(value), new Date()) ? "today" : shortDate(value);
}

/** "today 14:32" or "Oct 2 · 09:10". */
export function editedLabel(value: string) {
  const d = new Date(value);
  return isSameDay(d, new Date()) ? `today ${time(d)}` : `${shortDate(value)} · ${time(d)}`;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function groupNotes(notes: Note[]) {
  const now = Date.now();
  const groups: { label: string; pinned?: boolean; notes: Note[] }[] = [
    { label: "Pinned", pinned: true, notes: [] },
    { label: "This week", notes: [] },
    { label: "Earlier", notes: [] },
  ];
  for (const note of notes) {
    if (note.pinned) groups[0].notes.push(note);
    else if (now - new Date(note.updatedAt).getTime() < WEEK_MS) groups[1].notes.push(note);
    else groups[2].notes.push(note);
  }
  return groups.filter((g) => g.notes.length > 0);
}

const TAG_TONES = [
  "bg-warning/15 text-warning-strong",
  "bg-info/12 text-info-strong",
  "bg-success/14 text-success-strong",
  "bg-special/12 text-special-strong",
  "bg-destructive/10 text-destructive-strong",
];

/** A stable color per tag name. */
export function tagTone(tag: string) {
  let hash = 0;
  for (const ch of tag) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TAG_TONES[Math.abs(hash) % TAG_TONES.length];
}

/** True when the key press is inside a field, so page shortcuts stay out of the way. */
export function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
