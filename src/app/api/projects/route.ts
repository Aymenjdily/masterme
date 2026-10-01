import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validations";
import { fetchPreviewImage } from "@/lib/og-preview";
import { latestInfraByProject, recalculateForProject } from "@/lib/infra-cost";
import { logCountsByProject } from "@/lib/project-logs";
import { resolveVercelLink } from "@/lib/vercel-link";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [projects, infra, logs] = await Promise.all([
    prisma.project.findMany({
      where: { userId: session.user.id },
      include: { billings: true, monthlyCosts: true },
      orderBy: { createdAt: "desc" },
    }),
    latestInfraByProject(session.user.id),
    logCountsByProject(session.user.id),
  ]);

  return Response.json(
    projects.map((p) => ({
      ...p,
      infra: infra.get(p.id) ?? null,
      logs: logs.get(p.id) ?? { errors: 0, warnings: 0 },
    }))
  );
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { url, neonProjectId, vercelProjectId, ...rest } = parsed.data;
  const vercel = await resolveVercelLink(vercelProjectId);
  if (vercel === "invalid") {
    return Response.json({ error: "Unknown Vercel project" }, { status: 400 });
  }
  const previewImageUrl = url ? await fetchPreviewImage(url) : null;

  const project = await prisma.project.create({
    data: {
      ...rest,
      url,
      previewImageUrl,
      neonProjectId: neonProjectId || null,
      ...vercel,
      userId: session.user.id,
    },
    include: { billings: true, monthlyCosts: true },
  });

  // First infra reading right away, so it doesn't wait for tomorrow's run.
  if (project.neonProjectId) await recalculateForProject(session.user.id, project.id);

  return Response.json(project, { status: 201 });
}
