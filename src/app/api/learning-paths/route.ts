import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { learningPathSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paths = await prisma.learningPath.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return Response.json(paths);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = learningPathSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const path = await prisma.learningPath.create({
    data: { ...parsed.data, userId: session.user.id },
    include: { items: true },
  });

  return Response.json(path, { status: 201 });
}
