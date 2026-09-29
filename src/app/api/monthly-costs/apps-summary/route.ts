import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { latestInfraByProject, latestNeonAccount } from "@/lib/infra-cost";
import { VERCEL_PLAN_MONTHLY_USD } from "@/lib/hosting";

// Reads the stored daily Neon readings (see lib/infra-cost.ts); no live Neon calls here.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [projects, infra, account] = await Promise.all([
    prisma.project.findMany({
      where: { userId: session.user.id },
      select: { id: true, title: true, neonProjectId: true, vercelHosting: true, _count: { select: { monthlyCosts: true } } },
    }),
    latestInfraByProject(session.user.id),
    latestNeonAccount(session.user.id),
  ]);

  const neonLinked = projects.filter((p) => p.neonProjectId);
  // A project with linked monthly costs is already counted by those costs, so its Neon usage is left out
  // (same rule as the project card).
  const coveredByCosts = neonLinked.filter((p) => p._count.monthlyCosts > 0);
  const excludedUsd = coveredByCosts.reduce((sum, p) => sum + (infra.get(p.id)?.neonUsd ?? 0), 0);

  const neonItems = neonLinked
    .filter((p) => p._count.monthlyCosts === 0)
    .flatMap((p) => {
      const reading = infra.get(p.id);
      return reading ? [{ projectId: p.id, title: p.title, totalUsd: reading.neonUsd, stale: reading.stale }] : [];
    })
    .sort((a, b) => b.totalUsd - a.totalUsd);
  const linkedUsd = neonItems.reduce((sum, i) => sum + i.totalUsd, 0);
  const linkedNeonIds = new Set(neonLinked.map((p) => p.neonProjectId));

  // With the whole-account reading, the Neon total matches the Neon bill: linked projects plus everything else.
  const neonTotalUsd = account ? Math.max(0, account.totalUsd - excludedUsd) : linkedUsd;
  const other = account
    ? {
        count: Math.max(0, account.projectCount - linkedNeonIds.size),
        totalUsd: Number(Math.max(0, neonTotalUsd - linkedUsd).toFixed(2)),
      }
    : null;

  const vercelProjects = projects.filter((p) => p.vercelHosting);
  // Hosted projects share one plan, so they carry no individual price.
  const vercelItems = vercelProjects.map((p) => ({ projectId: p.id, title: p.title, totalUsd: 0 }));
  const vercelTotalUsd = vercelItems.length > 0 ? VERCEL_PLAN_MONTHLY_USD : 0;

  const readings = [...infra.values()];
  const times = [...readings.map((r) => r.updatedAt), ...(account ? [account.updatedAt] : [])].sort();

  return Response.json({
    neon: {
      totalUsd: Number(neonTotalUsd.toFixed(2)),
      items: neonItems,
      other,
      accountProjects: account?.projectCount ?? null,
      linkedProjects: linkedNeonIds.size,
      source: account ? "account" : "linked",
    },
    vercel: { totalUsd: vercelTotalUsd, items: vercelItems },
    totalUsd: Number((neonTotalUsd + vercelTotalUsd).toFixed(2)),
    updatedAt: times.at(-1) ?? null,
    staleCount: readings.filter((r) => r.stale).length + (account?.stale ? 1 : 0),
    pendingCount: projects.filter((p) => p.neonProjectId && !infra.has(p.id)).length,
  });
}
