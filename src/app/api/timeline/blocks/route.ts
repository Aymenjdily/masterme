import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeBlockSchema } from "@/lib/validations";
import { isValidDateParam, parseDateParam } from "@/lib/date";

const bodySchema = timeBlockSchema.extend({
  date: z.string(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, ...blockData } = parsed.data;
  if (!isValidDateParam(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  if (blockData.noteId) {
    const note = await prisma.note.findFirst({ where: { id: blockData.noteId, userId: session.user.id }, select: { id: true } });
    if (!note) {
      return Response.json({ error: "Unknown note" }, { status: 400 });
    }
  }

  const timeline = await prisma.timeline.upsert({
    where: { userId_date: { userId: session.user.id, date: parseDateParam(date) } },
    create: { userId: session.user.id, date: parseDateParam(date) },
    update: {},
  });

  // A block from a note never replaces one of your blocks.
  if (blockData.noteId) {
    const taken = await prisma.timeBlock.findUnique({
      where: { timelineId_hour: { timelineId: timeline.id, hour: blockData.hour } },
      select: { id: true },
    });
    if (taken) {
      return Response.json({ error: "That hour is already taken" }, { status: 409 });
    }
  }

  const block = await prisma.timeBlock.upsert({
    where: { timelineId_hour: { timelineId: timeline.id, hour: blockData.hour } },
    create: { ...blockData, timelineId: timeline.id },
    update: blockData,
  });

  return Response.json(block, { status: 201 });
}
