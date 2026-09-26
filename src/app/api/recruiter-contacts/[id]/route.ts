import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recruiterContactUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/recruiter-contacts/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.recruiterContact.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = recruiterContactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { markContacted, restoreContactedAt, end, reopen, restoreEnd, ...rest } = parsed.data;
  const date = (iso: string | null) => (iso ? new Date(iso) : null);

  const contact = await prisma.recruiterContact.update({
    where: { id },
    data: {
      ...rest,
      ...(markContacted ? { lastContactedAt: new Date() } : {}),
      ...(restoreContactedAt !== undefined ? { lastContactedAt: date(restoreContactedAt) } : {}),
      ...(end ? { endedAt: new Date(), endReason: end.reason, endNote: end.note || null } : {}),
      ...(reopen ? { endedAt: null, endReason: null, endNote: null, lastContactedAt: new Date() } : {}),
      ...(restoreEnd
        ? {
            endedAt: date(restoreEnd.endedAt),
            endReason: restoreEnd.endReason,
            endNote: restoreEnd.endNote,
            lastContactedAt: date(restoreEnd.lastContactedAt),
          }
        : {}),
    },
  });

  return Response.json(contact);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/recruiter-contacts/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.recruiterContact.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.recruiterContact.delete({ where: { id } });

  return Response.json({ success: true });
}
