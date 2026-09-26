import { prisma } from "@/lib/prisma";
import { getNeonProjectCostEstimate } from "@/lib/neon";

// Daily infra cost: the Neon usage estimate (month to date) for each Neon-linked project,
// stored once per project per day. Pages read these stored values instead of calling Neon.
// Vercel stays a flat plan (lib/hosting.ts); linked monthly costs are already in the database.

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

async function recalculate(targets: Target[]): Promise<RecalcResult> {
  const day = todayUtc();
  const failed: string[] = [];
  let updated = 0;
  let next = 0;

  async function worker() {
    while (next < targets.length) {
      const p = targets[next++];
      try {
        const { totalUsd } = await getNeonProjectCostEstimate(p.neonProjectId);
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
  return { updated, failed, at: new Date().toISOString() };
}

const neonProjects = (where: { userId?: string; id?: string }) =>
  prisma.project.findMany({
    where: { ...where, neonProjectId: { not: null } },
    select: { id: true, userId: true, title: true, neonProjectId: true },
  }) as Promise<Target[]>;

/** Recalculates every Neon-linked project for one user. */
export async function recalculateForUser(userId: string) {
  return recalculate(await neonProjects({ userId }));
}

/** Recalculates one project right after it gets a Neon link. Never throws. */
export async function recalculateForProject(userId: string, projectId: string) {
  try {
    return await recalculate(await neonProjects({ userId, id: projectId }));
  } catch (err) {
    console.error("[infra-cost] first reading failed:", err);
    return null;
  }
}

/** Daily job: every user's Neon-linked projects. */
export async function recalculateForAllUsers() {
  return recalculate(await neonProjects({}));
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
