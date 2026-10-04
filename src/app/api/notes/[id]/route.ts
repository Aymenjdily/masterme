import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { noteSchema } from "@/lib/validations";

export async function PATCH(request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await ctx.params;
  const { count } = await prisma.note.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
  });
  if (count === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const note = await prisma.note.findUnique({ where: { id } });
  return Response.json(note);
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { count } = await prisma.note.deleteMany({ where: { id, userId: session.user.id } });
  if (count === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
