import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobApplicationUpdateSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/job-applications/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = jobApplicationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { markFollowedUp, restoreFollowUpAt, ...rest } = parsed.data;

  const application = await prisma.jobApplication.update({
    where: { id },
    data: {
      ...rest,
      ...(markFollowedUp ? { lastFollowUpAt: new Date() } : {}),
      ...(restoreFollowUpAt !== undefined
        ? { lastFollowUpAt: restoreFollowUpAt ? new Date(restoreFollowUpAt) : null }
        : {}),
    },
    include: { jobOffer: true },
  });

  return Response.json(application);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/job-applications/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.jobApplication.delete({ where: { id } });

  // A manual offer only exists to hold this application; remove it too so it doesn't linger.
  await prisma.jobOffer.deleteMany({
    where: { id: existing.jobOfferId, userId: session.user.id, source: "manual", applications: { none: {} } },
  });

  return Response.json({ success: true });
}
