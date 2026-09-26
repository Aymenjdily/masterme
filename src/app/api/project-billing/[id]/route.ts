import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectBillingUpdateSchema } from "@/lib/validations";

async function findOwnedBilling(id: string, userId: string) {
  return prisma.projectBilling.findFirst({
    where: { id, project: { userId } },
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/project-billing/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findOwnedBilling(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = projectBillingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { invoiceDate, ...rest } = parsed.data;

  const billing = await prisma.projectBilling.update({
    where: { id },
    data: {
      ...rest,
      ...(invoiceDate !== undefined
        ? { invoiceDate: invoiceDate ? new Date(invoiceDate) : null }
        : {}),
    },
  });

  return Response.json(billing);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/project-billing/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findOwnedBilling(id, session.user.id);
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectBilling.delete({ where: { id } });

  return Response.json({ success: true });
}
