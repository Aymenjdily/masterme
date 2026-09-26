import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { latestInfraByProject } from "@/lib/infra-cost";
import { VERCEL_PLAN_MONTHLY_USD } from "@/lib/hosting";

// Reads the stored daily Neon readings (see lib/infra-cost.ts); no live Neon calls here.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [projects, infra] = await Promise.all([
    prisma.project.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true, neonProjectId: true, vercelHosting: true, _count: { select: { monthlyCosts: true } } },
    }),
    latestInfraByProject(session.user.id),
  ]);

  // A project with linked monthly costs is already counted by those costs, so its Neon estimate is left out
  // (same rule as the project card).
  const neonLinked = projects.filter((p) => p.neonProjectId && p._count.monthlyCosts === 0);
  const neonItems = neonLinked.flatMap((p) => {
    const reading = infra.get(p.id);
    return reading ? [{ projectId: p.id, title: p.title, totalUsd: reading.neonUsd, stale: reading.stale }] : [];
  });
  const neonTotalUsd = Number(neonItems.reduce((sum, i) => sum + i.totalUsd, 0).toFixed(2));

  const vercelProjects = projects.filter((p) => p.vercelHosting);
  // Hosted projects share one plan, so they carry no individual price.
  const vercelItems = vercelProjects.map((p) => ({ projectId: p.id, title: p.title, totalUsd: 0 }));
  const vercelTotalUsd = vercelItems.length > 0 ? VERCEL_PLAN_MONTHLY_USD : 0;

  const readings = [...infra.values()];
  const updatedAt = readings.length ? readings.map((r) => r.updatedAt).sort().at(-1)! : null;

  return Response.json({
    neon: { totalUsd: neonTotalUsd, items: neonItems },
    vercel: { totalUsd: vercelTotalUsd, items: vercelItems },
    totalUsd: Number((neonTotalUsd + vercelTotalUsd).toFixed(2)),
    updatedAt,
    staleCount: readings.filter((r) => r.stale).length,
    pendingCount: projects.filter((p) => p.neonProjectId && !infra.has(p.id)).length,
  });
}
