import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthlyCostSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const costs = await prisma.monthlyCost.findMany({
    where: { userId: session.user.id },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(costs);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = monthlyCostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const projectId = parsed.data.projectId || null;

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
  }

  const cost = await prisma.monthlyCost.create({
    data: {
      ...parsed.data,
      projectId,
      userId: session.user.id,
    },
    include: { project: { select: { id: true, title: true } } },
  });

  return Response.json(cost, { status: 201 });
}
