import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { portfolioLinkSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await prisma.portfolioLink.findMany({
    where: { userId: session.user.id },
    orderBy: { order: "asc" },
  });

  return Response.json(links);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = portfolioLinkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const last = await prisma.portfolioLink.findFirst({
    where: { userId: session.user.id },
    orderBy: { order: "desc" },
  });

  const link = await prisma.portfolioLink.create({
    data: {
      ...parsed.data,
      order: last ? last.order + 1 : 0,
      userId: session.user.id,
    },
  });

  return Response.json(link, { status: 201 });
}
