import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learningPathUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/learning-paths/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.learningPath.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = learningPathUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const path = await prisma.learningPath.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json(path);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/learning-paths/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.learningPath.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Items are removed by the onDelete: Cascade relation.
  await prisma.learningPath.delete({ where: { id } });

  return Response.json({ success: true });
}
