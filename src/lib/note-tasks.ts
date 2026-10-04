import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notePreview, noteTitle } from "@/components/notes/note-utils";

// Notes tagged #todo, offered as tasks on the timeline (by hand or through Plan with AI). Server-only.

export const TODO_TAG = "todo";

/**
 * A #todo note is recommended for a day unless it already has a block on that day,
 * or any block made from it is completed.
 */
function recommendedWhere(userId: string, date: Date): Prisma.NoteWhereInput {
  return {
    userId,
    tags: { has: TODO_TAG },
    timeBlocks: { none: { OR: [{ status: "completed" }, { timeline: { userId, date } }] } },
  };
}

export type NoteTask = { id: string; title: string; preview: string; body: string; pinned: boolean };

export async function recommendedNoteTasks(userId: string, date: Date, take: number) {
  const where = recommendedWhere(userId, date);
  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take,
      select: { id: true, title: true, body: true, pinned: true },
    }),
    prisma.note.count({ where }),
  ]);
  const tasks: NoteTask[] = notes.map((note) => ({
    id: note.id,
    title: noteTitle(note).slice(0, 120),
    preview: notePreview(note).slice(0, 90),
    body: note.body,
    pinned: note.pinned,
  }));
  return { tasks, total };
}

export const noteBlockDescription = (title: string) => `From your note “${title}”`.slice(0, 200);
