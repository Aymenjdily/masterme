import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { productionDeployments, type VercelLogLine } from "@/lib/vercel";

// Project logs from Vercel (see lib/vercel.ts and /api/logs/stream):
// - only errors and warnings are saved; info lines are only passed to the open terminal,
// - the same line on the same day is grouped into one row with a count,
// - production deployments are saved as "build" rows, so builds have history even when nobody watched,
// - errors and warnings are kept 7 days, builds 30.

export type LogLevel = "error" | "warn" | "info";

const MAX_MESSAGE = 4000;
const KEEP_LOGS_MS = 7 * 24 * 60 * 60 * 1000;
const KEEP_BUILDS_MS = 30 * 24 * 60 * 60 * 1000;

export function classify(line: Pick<VercelLogLine, "level" | "message" | "responseStatusCode">): LogLevel {
  const status = line.responseStatusCode ?? 0;
  // Node process warnings (deprecations, the pg SSL notice) are written to stderr, so Vercel calls them errors.
  if (/^\(node:\d+\) \w*Warning:/.test(line.message)) return "warn";
  if (line.level === "error" || line.level === "fatal" || status >= 500) return "error";
  if (line.level === "warn" || line.level === "warning" || (status >= 400 && status < 500)) return "warn";
  return "info";
}

/** First line of a message with timestamps, ids and numbers blanked, so repeats group together. */
function normalize(message: string) {
  return (message.split("\n")[0] ?? "")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#")
    .replace(/\b[0-9a-z]{20,}\b/gi, "#")
    .replace(/\d+/g, "#")
    .trim()
    .slice(0, 300);
}

function fingerprint(parts: (string | null | undefined)[]) {
  return createHash("sha1").update(parts.map((p) => p ?? "").join("|")).digest("hex");
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const cleanPath = (path: string | null) => (path ? path.split("?")[0] : null);

/** Saves an error or warning line, grouped with the same line earlier that day. */
export async function saveLogLine(
  userId: string,
  projectId: string,
  deploymentId: string,
  line: VercelLogLine,
  level: Exclude<LogLevel, "info">
) {
  const path = cleanPath(line.requestPath);
  const at = new Date(line.timestampInMs);
  const message = line.message.slice(0, MAX_MESSAGE);
  const key = fingerprint([level, dayKey(line.timestampInMs), line.requestMethod, path, normalize(line.message)]);

  return prisma.projectLog.upsert({
    where: { projectId_fingerprint: { projectId, fingerprint: key } },
    create: {
      userId,
      projectId,
      level,
      fingerprint: key,
      method: line.requestMethod,
      path,
      status: line.responseStatusCode,
      message,
      source: line.source,
      domain: line.domain,
      deploymentId,
      firstAt: at,
      lastAt: at,
    },
    update: {
      count: { increment: 1 },
      lastAt: at,
      message,
      deploymentId,
      ...(line.responseStatusCode ? { status: line.responseStatusCode } : {}),
    },
  });
}

const BUILDS_TTL_MS = 60 * 1000;
const buildsSyncedAt = new Map<string, number>();

/** Saves the latest production deployments as build rows (at most once a minute per project). */
export async function syncBuilds(userId: string, project: { id: string; vercelProjectId: string }) {
  const last = buildsSyncedAt.get(project.id);
  if (last && Date.now() - last < BUILDS_TTL_MS) return;
  buildsSyncedAt.set(project.id, Date.now());

  const deployments = await productionDeployments(project.vercelProjectId, 10);
  for (const d of deployments) {
    const data = {
      message: d.state,
      buildState: d.state,
      lastAt: new Date(d.readyAt ?? d.createdAt),
      durationS: d.readyAt && d.buildingAt ? Math.max(0, Math.round((d.readyAt - d.buildingAt) / 1000)) : null,
    };
    await prisma.projectLog.upsert({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint: `build|${d.id}` } },
      create: {
        userId,
        projectId: project.id,
        level: "build",
        fingerprint: `build|${d.id}`,
        deploymentId: d.id,
        domain: d.url,
        commitMessage: d.commitMessage?.split("\n")[0].slice(0, 200) ?? null,
        commitSha: d.commitSha,
        branch: d.branch,
        firstAt: new Date(d.createdAt),
        ...data,
      },
      update: data,
    });
  }
}

const prunedAt = new Map<string, number>();

/** Deletes old rows for one user (at most once an hour). */
export async function pruneLogs(userId: string) {
  const last = prunedAt.get(userId);
  if (last && Date.now() - last < 60 * 60 * 1000) return;
  prunedAt.set(userId, Date.now());
  const now = Date.now();
  await prisma.projectLog.deleteMany({
    where: {
      userId,
      OR: [
        { level: { in: ["error", "warn"] }, lastAt: { lt: new Date(now - KEEP_LOGS_MS) } },
        { level: "build", lastAt: { lt: new Date(now - KEEP_BUILDS_MS) } },
      ],
    },
  });
}

/** Error and warning counts per project over the last 24 h, for the project cards. */
export async function logCountsByProject(userId: string) {
  const rows = await prisma.projectLog.groupBy({
    by: ["projectId", "level"],
    where: { userId, level: { in: ["error", "warn"] }, lastAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    _sum: { count: true },
  });
  const out = new Map<string, { errors: number; warnings: number }>();
  for (const row of rows) {
    const entry = out.get(row.projectId) ?? { errors: 0, warnings: 0 };
    if (row.level === "error") entry.errors += row._sum.count ?? 0;
    else entry.warnings += row._sum.count ?? 0;
    out.set(row.projectId, entry);
  }
  return out;
}

/** Errors since the user last opened /logs (the sidebar badge). */
export async function unseenErrorCount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { logsSeenAt: true } });
  const since = user?.logsSeenAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.projectLog.aggregate({
    where: { userId, level: "error", lastAt: { gt: since } },
    _count: true,
  });
  return rows._count;
}
