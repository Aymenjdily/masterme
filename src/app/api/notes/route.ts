import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { noteSchema, noteTagSchema } from "@/lib/validations";

/** Lists the user's notes (pinned first, then last edited) with tag counts across all notes. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100) ?? "";
  const tag = noteTagSchema.safeParse(params.get("tag") ?? "");
  const pinned = params.get("pinned") === "true";

  const where: Prisma.NoteWhereInput = { userId };
  if (pinned) where.pinned = true;
  if (tag.success) where.tags = { has: tag.data };
  if (q) {
    const term = q.replace(/^#/, "").toLowerCase();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { tags: { has: term } },
    ];
  }

  const [notes, allTags, total] = await Promise.all([
    prisma.note.findMany({ where, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] }),
    prisma.note.findMany({ where: { userId }, select: { tags: true } }),
    prisma.note.count({ where: { userId } }),
  ]);

  const counts = new Map<string, number>();
  for (const note of allTags) for (const t of note.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return Response.json({ notes, tags, total });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: { ...parsed.data, userId: session.user.id },
  });

  return Response.json(note, { status: 201 });
}
