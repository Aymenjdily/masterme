import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { socialAppSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apps = await prisma.socialApp.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return Response.json(apps);
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = socialAppSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const app = await prisma.socialApp.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  return Response.json(app, { status: 201 });
}
