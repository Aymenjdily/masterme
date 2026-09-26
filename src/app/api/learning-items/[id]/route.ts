import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learningItemUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/learning-items/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.learningItem.findFirst({
    where: { id, learningPath: { userId: session.user.id } },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = learningItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.learningItem.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json(item);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/learning-items/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.learningItem.findFirst({
    where: { id, learningPath: { userId: session.user.id } },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.learningItem.delete({ where: { id } });

  return Response.json({ success: true });
}
