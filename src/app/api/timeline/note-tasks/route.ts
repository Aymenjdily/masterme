import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isValidDateParam, parseDateParam } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { recommendedNoteTasks, TODO_TAG } from "@/lib/note-tasks";

const SHOWN = 3;

/** #todo notes to offer on the timeline for a day (no AI). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!isValidDateParam(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const [{ tasks, total }, todoTotal] = await Promise.all([
    recommendedNoteTasks(session.user.id, parseDateParam(date), SHOWN),
    prisma.note.count({ where: { userId: session.user.id, tags: { has: TODO_TAG } } }),
  ]);
  return Response.json({
    notes: tasks.map(({ id, title, preview, pinned }) => ({ id, title, preview, pinned })),
    total,
    /** All #todo notes, including ones already planned or done */
    todoTotal,
  });
}
