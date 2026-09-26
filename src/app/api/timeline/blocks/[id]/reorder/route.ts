import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reorderSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/timeline/blocks/[id]/reorder">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const block = await prisma.timeBlock.findFirst({
    where: { id, timeline: { userId: session.user.id } },
  });
  if (!block) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const targetHour =
    parsed.data.direction === "up" ? block.hour - 1 : block.hour + 1;
  if (targetHour < 0 || targetHour > 7) {
    return Response.json({ error: "Cannot move outside the day" }, { status: 400 });
  }

  const neighbor = await prisma.timeBlock.findFirst({
    where: { timelineId: block.timelineId, hour: targetHour },
  });

  await prisma.$transaction(async (tx) => {
    if (neighbor) {
      // Move both out of range momentarily to avoid the unique(timelineId, hour) constraint colliding.
      await tx.timeBlock.update({ where: { id: block.id }, data: { hour: -1 } });
      await tx.timeBlock.update({
        where: { id: neighbor.id },
        data: { hour: block.hour },
      });
      await tx.timeBlock.update({
        where: { id: block.id },
        data: { hour: targetHour },
      });
    } else {
      await tx.timeBlock.update({
        where: { id: block.id },
        data: { hour: targetHour },
      });
    }
  });

  return Response.json({ success: true });
}
