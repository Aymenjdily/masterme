import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectUpdateSchema } from "@/lib/validations";
import { fetchPreviewImage } from "@/lib/og-preview";
import { recalculateForProject } from "@/lib/infra-cost";
import { resolveVercelLink } from "@/lib/vercel-link";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/projects/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, neonProjectId, vercelProjectId, refreshPreview, ...rest } = parsed.data;
  const vercel = await resolveVercelLink(vercelProjectId);
  if (vercel === "invalid") {
    return Response.json({ error: "Unknown Vercel project" }, { status: 400 });
  }
  const urlChanged = url !== undefined && url !== existing.url;
  const effectiveUrl = url !== undefined ? url : existing.url;
  const previewImageUrl =
    urlChanged || refreshPreview
      ? effectiveUrl
        ? await fetchPreviewImage(effectiveUrl)
        : null
      : undefined;

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...rest,
      ...(url !== undefined ? { url } : {}),
      ...(previewImageUrl !== undefined ? { previewImageUrl } : {}),
      ...(neonProjectId !== undefined ? { neonProjectId: neonProjectId || null } : {}),
      ...vercel,
    },
    include: { billings: true, monthlyCosts: true },
  });

  // A new Neon link gets its first infra reading right away.
  if (project.neonProjectId && project.neonProjectId !== existing.neonProjectId) {
    await recalculateForProject(session.user.id, project.id);
  }

  return Response.json(project);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[id]">
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });

  return Response.json({ success: true });
}
