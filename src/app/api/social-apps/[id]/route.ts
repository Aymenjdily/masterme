import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { socialAppSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/social-apps/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.socialApp.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = socialAppSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const app = await prisma.socialApp.update({
    where: { id },
    data: parsed.data,
  });

  return Response.json(app);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/social-apps/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.socialApp.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.socialApp.delete({ where: { id } });

  return Response.json({ success: true });
}
