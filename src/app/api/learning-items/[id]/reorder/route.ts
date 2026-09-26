import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reorderSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/learning-items/[id]/reorder">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const item = await prisma.learningItem.findFirst({
    where: { id, learningPath: { userId: session.user.id } },
  });
  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Nearest neighbor in that direction; orders can have gaps after deletes.
  const up = parsed.data.direction === "up";
  const neighbor = await prisma.learningItem.findFirst({
    where: {
      learningPathId: item.learningPathId,
      order: up ? { lt: item.order } : { gt: item.order },
    },
    orderBy: { order: up ? "desc" : "asc" },
  });
  if (!neighbor) {
    return Response.json({ error: "Already at the edge" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.learningItem.update({ where: { id: item.id }, data: { order: neighbor.order } }),
    prisma.learningItem.update({ where: { id: neighbor.id }, data: { order: item.order } }),
  ]);

  return Response.json({ success: true });
}
