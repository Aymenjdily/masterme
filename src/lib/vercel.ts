const VERCEL_API_BASE = "https://api.vercel.com";

// Server-only Vercel client: the project picker, production deployments (builds) and the
// runtime-logs stream. The token never leaves the server; the browser only calls MasterMe routes.

export type VercelProjectOption = { id: string; name: string };

export type VercelDeployment = {
  id: string;
  url: string | null;
  state: string;
  createdAt: number;
  readyAt: number | null;
  buildingAt: number | null;
  commitMessage: string | null;
  commitSha: string | null;
  branch: string | null;
};

/** One line from Vercel's runtime-logs stream. */
export type VercelLogLine = {
  rowId: string;
  level: string;
  message: string;
  source: string | null;
  timestampInMs: number;
  requestMethod: string | null;
  requestPath: string | null;
  domain: string | null;
  responseStatusCode: number | null;
};

function token() {
  const value = process.env.VERCEL_API_TOKEN;
  if (!value) throw new Error("VERCEL_API_TOKEN not configured");
  return value;
}

export function vercelConfigured() {
  return !!process.env.VERCEL_API_TOKEN;
}

let cachedTeamId: string | null | undefined;

// The token's default team, unless VERCEL_TEAM_ID says otherwise.
async function teamId(): Promise<string | null> {
  if (process.env.VERCEL_TEAM_ID) return process.env.VERCEL_TEAM_ID;
  if (cachedTeamId !== undefined) return cachedTeamId;
  const res = await fetch(`${VERCEL_API_BASE}/v2/user`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error(`Vercel API /v2/user failed: ${res.status}`);
  const data = await res.json();
  cachedTeamId = data.user?.defaultTeamId ?? null;
  return cachedTeamId ?? null;
}

async function vercelUrl(path: string, params: Record<string, string> = {}) {
  const team = await teamId();
  const query = new URLSearchParams({ ...params, ...(team ? { teamId: team } : {}) });
  return `${VERCEL_API_BASE}${path}?${query}`;
}

async function vercelFetch(path: string, params: Record<string, string> = {}) {
  const res = await fetch(await vercelUrl(path, params), {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Vercel API ${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

const PROJECTS_TTL_MS = 10 * 60 * 1000;
let projectsCache: { at: number; projects: VercelProjectOption[] } | null = null;

/** Every project in the team, sorted by name (cached 10 minutes). */
export async function listVercelProjects(): Promise<VercelProjectOption[]> {
  if (projectsCache && Date.now() - projectsCache.at < PROJECTS_TTL_MS) return projectsCache.projects;
  const projects: VercelProjectOption[] = [];
  let until: string | undefined;
  for (let page = 0; page < 10; page++) {
    const data = await vercelFetch("/v10/projects", { limit: "100", ...(until ? { until } : {}) });
    for (const p of data.projects ?? []) projects.push({ id: p.id, name: p.name });
    const next = data.pagination?.next;
    if (!next) break;
    until = String(next);
  }
  projects.sort((a, b) => a.name.localeCompare(b.name));
  projectsCache = { at: Date.now(), projects };
  return projects;
}

/** Latest production deployments of a project, newest first. */
export async function productionDeployments(vercelProjectId: string, limit = 5): Promise<VercelDeployment[]> {
  const data = await vercelFetch("/v6/deployments", { projectId: vercelProjectId, target: "production", limit: String(limit) });
  return (data.deployments ?? []).map(
    (d: {
      uid: string;
      url?: string;
      state?: string;
      readyState?: string;
      created: number;
      ready?: number;
      buildingAt?: number;
      meta?: Record<string, string | undefined>;
    }): VercelDeployment => ({
      id: d.uid,
      url: d.url ?? null,
      state: d.state ?? d.readyState ?? "UNKNOWN",
      createdAt: d.created,
      readyAt: d.ready ?? null,
      buildingAt: d.buildingAt ?? null,
      commitMessage: d.meta?.githubCommitMessage ?? d.meta?.gitlabCommitMessage ?? null,
      commitSha: d.meta?.githubCommitSha ?? d.meta?.gitlabCommitSha ?? null,
      branch: d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? null,
    })
  );
}

/**
 * Vercel's runtime-logs stream for one deployment: only new lines (no history), one JSON object per line.
 * Works on the Hobby plan. Ends when Vercel closes the stream or `signal` aborts.
 */
export async function* runtimeLogs(
  vercelProjectId: string,
  deploymentId: string,
  signal: AbortSignal
): AsyncGenerator<VercelLogLine> {
  const res = await fetch(await vercelUrl(`/v1/projects/${vercelProjectId}/deployments/${deploymentId}/runtime-logs`), {
    headers: { Authorization: `Bearer ${token()}` },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Vercel runtime logs failed: ${res.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!raw) continue;
      try {
        const line = JSON.parse(raw);
        yield {
          rowId: String(line.rowId ?? `${line.timestampInMs}`),
          level: String(line.level ?? "info"),
          message: String(line.message ?? ""),
          source: line.source ?? null,
          timestampInMs: Number(line.timestampInMs ?? Date.now()),
          requestMethod: line.requestMethod ?? null,
          requestPath: line.requestPath ?? null,
          domain: line.domain ?? null,
          // Vercel sends -1 while the response status isn't known yet.
          responseStatusCode: typeof line.responseStatusCode === "number" && line.responseStatusCode > 0 ? line.responseStatusCode : null,
        };
      } catch {
        // Not JSON (keep-alive or a partial line Vercel never finished): skip it.
      }
    }
  }
}

let cachedTeamSlug: string | null | undefined;

/** Link to a project's logs in the Vercel dashboard (null if the team can't be resolved). */
export async function vercelLogsLink(projectName: string): Promise<string | null> {
  if (cachedTeamSlug === undefined) {
    const team = await teamId();
    cachedTeamSlug = team ? ((await vercelFetch(`/v2/teams/${team}`).catch(() => null))?.slug ?? null) : null;
  }
  return cachedTeamSlug ? `https://vercel.com/${cachedTeamSlug}/${projectName}/logs` : null;
}
