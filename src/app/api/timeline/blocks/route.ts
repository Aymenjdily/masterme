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

  const timeline = await prisma.timeline.upsert({
    where: { userId_date: { userId: session.user.id, date: parseDateParam(date) } },
    create: { userId: session.user.id, date: parseDateParam(date) },
    update: {},
  });

  const block = await prisma.timeBlock.upsert({
    where: { timelineId_hour: { timelineId: timeline.id, hour: blockData.hour } },
    create: { ...blockData, timelineId: timeline.id },
    update: blockData,
  });

  return Response.json(block, { status: 201 });
}
