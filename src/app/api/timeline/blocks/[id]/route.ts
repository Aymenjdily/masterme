import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { timeBlockUpdateSchema } from "@/lib/validations";

async function findOwnedBlock(id: string, userId: string) {
  return prisma.timeBlock.findFirst({
    where: { id, timeline: { userId } },
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/timeline/blocks/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findOwnedBlock(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = timeBlockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const block = await prisma.timeBlock.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json(block);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/timeline/blocks/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findOwnedBlock(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.timeBlock.delete({ where: { id } });

  return Response.json({ success: true });
}
