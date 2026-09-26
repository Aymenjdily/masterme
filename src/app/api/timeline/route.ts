import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidDateParam, parseDateParam, todayDateParam } from "@/lib/date";
import { wakeUpHourSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayDateParam();
  if (!isValidDateParam(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const timeline = await prisma.timeline.findFirst({
    where: { userId: session.user.id, date: parseDateParam(date) },
    include: { blocks: { orderBy: { hour: "asc" } } },
  });

  return Response.json({ timeline });
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = wakeUpHourSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { date, wakeUpHour } = parsed.data;
  if (!isValidDateParam(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }

  const timeline = await prisma.timeline.upsert({
    where: { userId_date: { userId: session.user.id, date: parseDateParam(date) } },
    create: { userId: session.user.id, date: parseDateParam(date), wakeUpHour },
    update: { wakeUpHour },
    include: { blocks: { orderBy: { hour: "asc" } } },
  });

  return Response.json({ timeline });
}
