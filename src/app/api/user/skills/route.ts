import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSkillsSchema } from "@/lib/validations";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { skills: true, newsFetchedAt: true },
  });

  return Response.json({ skills: user?.skills ?? [], newsFetchedAt: user?.newsFetchedAt ?? null });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = userSkillsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { skills: parsed.data.skills },
    select: { skills: true },
  });

  return Response.json(user);
}
