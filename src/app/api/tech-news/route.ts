import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { techNewsSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.techNews.findMany({
    where: { userId: session.user.id },
    orderBy: { publishedDate: "desc" },
  });

  return Response.json(items);
}

/** Saves one item to the radar by hand (e.g. from Paste anything). */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = techNewsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.techNews.findUnique({
    where: { userId_url: { userId: session.user.id, url: parsed.data.url } },
  });
  if (existing) {
    return Response.json({ error: "This link is already on your radar" }, { status: 409 });
  }

  const { publishedDate, tags, ...rest } = parsed.data;
  const item = await prisma.techNews.create({
    data: {
      ...rest,
      tags: tags ?? [],
      publishedDate: publishedDate ? new Date(publishedDate) : new Date(),
      userId: session.user.id,
    },
  });

  return Response.json(item, { status: 201 });
}
