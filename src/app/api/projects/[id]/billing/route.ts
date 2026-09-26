import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectBillingSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/projects/[id]/billing">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = projectBillingSchema.safeParse({ ...body, projectId: id });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { invoiceDate, ...rest } = parsed.data;

  const billing = await prisma.projectBilling.create({
    data: {
      ...rest,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
    },
  });

  return Response.json(billing, { status: 201 });
}
