import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learningItemSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/learning-paths/[id]/items">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const path = await prisma.learningPath.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!path) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = learningItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const last = await prisma.learningItem.findFirst({
    where: { learningPathId: id },
    orderBy: { order: "desc" },
  });

  const item = await prisma.learningItem.create({
    data: {
      ...parsed.data,
      learningPathId: id,
      order: last ? last.order + 1 : 0,
    },
  });

  return Response.json(item, { status: 201 });
}
