import { prisma } from "@/lib/prisma";
import { getNeonAccountUsage, getNeonProjectCostEstimate, neonProjectNames, type NeonAccountUsage } from "@/lib/neon";

// Daily infra cost, from Neon's own usage (consumption history, all projects, billing period so far):
// - one row per Neon-linked project per day (InfraCostSnapshot),
// - one row per user per day for the whole Neon account (NeonAccountSnapshot), which matches the Neon bill.
// Pages read these stored values instead of calling Neon. Vercel stays a flat plan (lib/hosting.ts).

const CONCURRENCY = 4;
const MIN_INTERVAL_MS = 60 * 1000;

/** Today at 00:00 UTC, the key for the daily row. */
function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type InfraReading = { neonUsd: number; updatedAt: string; stale: boolean };

export type RecalcResult = { updated: number; failed: string[]; at: string };

type Target = { id: string; userId: string; title: string; neonProjectId: string };

async function recalculate(targets: Target[], accountUserIds: string[]): Promise<RecalcResult> {
  const day = todayUtc();
  const failed: string[] = [];
  let updated = 0;
  let next = 0;

  // One call for the whole account; if it fails, fall back to the per-project estimate below.
  let usage: NeonAccountUsage | null = null;
  try {
    usage = await getNeonAccountUsage();
  } catch (err) {
    console.error("[infra-cost] account usage failed, using per-project estimates:", err);
  }

  async function worker() {
    while (next < targets.length) {
      const p = targets[next++];
      try {
        const totalUsd =
          usage?.projects.get(p.neonProjectId)?.totalUsd ?? (await getNeonProjectCostEstimate(p.neonProjectId)).totalUsd;
        await prisma.infraCostSnapshot.upsert({
          where: { projectId_day: { projectId: p.id, day } },
          create: { userId: p.userId, projectId: p.id, neonProjectId: p.neonProjectId, day, neonUsd: totalUsd },
          update: { neonProjectId: p.neonProjectId, neonUsd: totalUsd },
        });
        updated++;
      } catch (err) {
        // The last good reading stays; the UI marks it as stale.
        console.error(`[infra-cost] ${p.title}:`, err);
        failed.push(p.title);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  if (usage) {
    // Names are only for display. A billed project missing from the list was deleted this period
    // (Neon still bills the days it existed); if the list can't be read, the Neon id is shown.
    const names = await neonProjectNames().catch(() => null);
    const projects: NeonAccountProject[] = [...usage.projects]
      .map(([id, u]) => ({
        id,
        name: names ? (names.get(id) ?? `Deleted project · ${id}`) : id,
        totalUsd: u.totalUsd,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);
    const account = {
      projects,
      periodStart: new Date(usage.periodStart),
      totalUsd: usage.totalUsd,
      computeUsd: usage.computeUsd,
      storageUsd: usage.storageUsd,
      projectCount: usage.projectCount,
    };
    for (const userId of new Set(accountUserIds)) {
      await prisma.neonAccountSnapshot.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, ...account },
        update: account,
      });
    }
  } else {
    failed.push("Neon account total");
  }
  return { updated, failed, at: new Date().toISOString() };
}

const neonProjects = (where: { userId?: string; id?: string }) =>
  prisma.project.findMany({
    where: { ...where, neonProjectId: { not: null } },
    select: { id: true, userId: true, title: true, neonProjectId: true },
  }) as Promise<Target[]>;

/** Recalculates every Neon-linked project for one user. */
export async function recalculateForUser(userId: string) {
  return recalculate(await neonProjects({ userId }), [userId]);
}

/** Recalculates one project right after it gets a Neon link. Never throws. */
export async function recalculateForProject(userId: string, projectId: string) {
  try {
    return await recalculate(await neonProjects({ userId, id: projectId }), [userId]);
  } catch (err) {
    console.error("[infra-cost] first reading failed:", err);
    return null;
  }
}

/** Daily job: every user's Neon-linked projects. */
export async function recalculateForAllUsers() {
  const targets = await neonProjects({});
  return recalculate(targets, targets.map((t) => t.userId));
}

/** True when this user recalculated less than a minute ago. */
export async function recalculatedRecently(userId: string) {
  const last = await prisma.infraCostSnapshot.findFirst({
    where: { userId, updatedAt: { gte: new Date(Date.now() - MIN_INTERVAL_MS) } },
    select: { id: true },
  });
  return !!last;
}

/**
 * Latest stored reading per project, only for the project's current Neon link.
 * `stale` means today's reading is missing (the last calculation failed or hasn't run yet today).
 */
export async function latestInfraByProject(userId: string): Promise<Map<string, InfraReading>> {
  const [projects, snapshots] = await Promise.all([
    prisma.project.findMany({ where: { userId, neonProjectId: { not: null } }, select: { id: true, neonProjectId: true } }),
    prisma.infraCostSnapshot.findMany({
      where: { userId },
      orderBy: { day: "desc" },
      distinct: ["projectId", "neonProjectId"],
      select: { projectId: true, neonProjectId: true, day: true, neonUsd: true, updatedAt: true },
    }),
  ]);

  const today = todayUtc().getTime();
  const current = new Map(projects.map((p) => [p.id, p.neonProjectId]));
  const out = new Map<string, InfraReading>();
  for (const s of snapshots) {
    if (current.get(s.projectId) !== s.neonProjectId || out.has(s.projectId)) continue;
    out.set(s.projectId, { neonUsd: s.neonUsd, updatedAt: s.updatedAt.toISOString(), stale: s.day.getTime() < today });
  }
  return out;
}

export type NeonAccountProject = { id: string; name: string; totalUsd: number };

export type NeonAccountReading = {
  totalUsd: number;
  computeUsd: number;
  storageUsd: number;
  projectCount: number;
  projects: NeonAccountProject[];
  updatedAt: string;
  stale: boolean;
};

/** Latest stored whole-account Neon total for this user, or null if never calculated. */
export async function latestNeonAccount(userId: string): Promise<NeonAccountReading | null> {
  const row = await prisma.neonAccountSnapshot.findFirst({ where: { userId }, orderBy: { day: "desc" } });
  if (!row) return null;
  return {
    totalUsd: row.totalUsd,
    computeUsd: row.computeUsd,
    storageUsd: row.storageUsd,
    projectCount: row.projectCount,
    projects: Array.isArray(row.projects) ? (row.projects as NeonAccountProject[]) : [],
    updatedAt: row.updatedAt.toISOString(),
    stale: row.day.getTime() < todayUtc().getTime(),
  };
}
