import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vercelConfigured, vercelLogsLink } from "@/lib/vercel";
import { logCountsByProject, pruneLogs, syncBuilds } from "@/lib/project-logs";

const DAY_MS = 24 * 60 * 60 * 1000;

// Saved logs for /logs: errors, warnings and builds (builds are refreshed from Vercel at most once a minute).
// Live lines arrive through /api/logs/stream.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const params = new URL(request.url).searchParams;
  const selected = params.get("project") ?? "all";
  const since = new Date(Date.now() - (params.get("range") === "7d" ? 7 : 1) * DAY_MS);

  const [projects, user] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      select: { id: true, title: true, vercelProjectId: true, vercelProjectName: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { logsSeenAt: true } }),
  ]);
  const current = selected === "all" ? null : projects.find((p) => p.id === selected);
  if (selected !== "all" && !current) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const linked = projects.filter((p): p is typeof p & { vercelProjectId: string } => !!p.vercelProjectId);
  const scope = current ? linked.filter((p) => p.id === current.id) : linked;
  if (vercelConfigured()) {
    const results = await Promise.allSettled(scope.map((p) => syncBuilds(userId, p)));
    results.forEach((r) => r.status === "rejected" && console.error("[api/logs] builds:", r.reason));
  }
  await pruneLogs(userId);

  const dayAgo = new Date(Date.now() - DAY_MS);
  const [logs, counts, recent] = await Promise.all([
    prisma.projectLog.findMany({
      where: { userId, lastAt: { gte: since }, ...(current ? { projectId: current.id } : {}) },
      orderBy: { lastAt: "desc" },
      take: 300,
    }),
    logCountsByProject(userId),
    prisma.projectLog.findMany({
      where: { userId, lastAt: { gte: dayAgo } },
      select: { projectId: true, level: true, count: true, lastAt: true, buildState: true },
    }),
  ]);

  const titles = new Map(projects.map((p) => [p.id, p]));
  const seenAt = user?.logsSeenAt ?? dayAgo;
  const errors = recent.filter((r) => r.level === "error");
  const builds = recent.filter((r) => r.level === "build");
  const failed = builds.filter((r) => r.buildState === "ERROR").sort((a, b) => +b.lastAt - +a.lastAt);
  const lastLog = recent.filter((r) => r.level !== "build").sort((a, b) => +b.lastAt - +a.lastAt)[0];

  return Response.json({
    configured: vercelConfigured(),
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      vercelProjectName: p.vercelProjectName,
      linked: !!p.vercelProjectId,
      errors: counts.get(p.id)?.errors ?? 0,
      warnings: counts.get(p.id)?.warnings ?? 0,
    })),
    logs: logs.map((l) => ({
      id: l.id,
      projectId: l.projectId,
      projectTitle: titles.get(l.projectId)?.title ?? "",
      vercelProjectName: titles.get(l.projectId)?.vercelProjectName ?? null,
      level: l.level,
      method: l.method,
      path: l.path,
      status: l.status,
      message: l.message,
      source: l.source,
      deploymentId: l.deploymentId,
      count: l.count,
      firstAt: l.firstAt.toISOString(),
      lastAt: l.lastAt.toISOString(),
      buildState: l.buildState,
      commitMessage: l.commitMessage,
      commitSha: l.commitSha,
      branch: l.branch,
      durationS: l.durationS,
    })),
    stats: {
      errors: errors.reduce((sum, r) => sum + r.count, 0),
      errorProjects: new Set(errors.map((r) => r.projectId)).size,
      newErrors: errors.filter((r) => r.lastAt > seenAt).length,
      warnings: recent.filter((r) => r.level === "warn").reduce((sum, r) => sum + r.count, 0),
      builds: builds.length,
      failedBuilds: failed.length,
      lastFailed: failed[0] ? { title: titles.get(failed[0].projectId)?.title ?? "", at: failed[0].lastAt.toISOString() } : null,
      lastLogAt: lastLog?.lastAt.toISOString() ?? null,
      linked: linked.length,
    },
    // Vercel dashboard links per linked project (the team slug is looked up once and cached).
    vercelLinks: Object.fromEntries(
      await Promise.all(
        linked.map(async (p) => [p.id, p.vercelProjectName ? await vercelLogsLink(p.vercelProjectName).catch(() => null) : null])
      )
    ),
  });
}
