import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthlyCostUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/monthly-costs/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.monthlyCost.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = monthlyCostUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { projectId, ...rest } = parsed.data;
  const normalizedProjectId = projectId === "" ? null : projectId;

  if (normalizedProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: normalizedProjectId, userId: session.user.id },
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const cost = await prisma.monthlyCost.update({
    where: { id },
    data: {
      ...rest,
      ...(projectId !== undefined ? { projectId: normalizedProjectId } : {}),
    },
    include: { project: { select: { id: true, title: true } } },
  });

  return Response.json(cost);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/monthly-costs/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.monthlyCost.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.monthlyCost.delete({ where: { id } });

  return Response.json({ success: true });
}
