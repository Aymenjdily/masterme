const NEON_API_BASE = "https://console.neon.tech/api/v2";

// Launch plan rates (per Neon's published pricing). These are estimates computed
// from raw usage — Neon's API does not return a dollar cost directly — so update
// these constants if your plan or Neon's pricing changes.
const COMPUTE_USD_PER_CU_HOUR = 0.106;
const STORAGE_USD_PER_GB_MONTH = 0.35;
const TRANSFER_USD_PER_GB = 0.1;
const TRANSFER_FREE_GB = 500;
// Instant-restore (history) storage, Launch plan.
const RESTORE_USD_PER_GB_MONTH = 0.2;
const GIB = 1024 ** 3;

/** A Neon project for pickers, with its estimated cost so far this billing period (null if unknown). */
export type NeonProjectOption = { id: string; name: string; estimateUsd: number | null };

export type NeonCostEstimate = {
  totalUsd: number;
  computeUsd: number;
  storageUsd: number;
  transferUsd: number;
  periodStart: string;
  periodEnd: string;
};

async function neonFetch(path: string) {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) {
    throw new Error("NEON_API_KEY not configured");
  }

  const res = await fetch(`${NEON_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neon API ${path} failed: ${res.status} ${body}`);
  }

  return res.json();
}

let cachedOrgId: string | null = null;

async function getOrgId(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId;
  const data = await neonFetch("/users/me/organizations");
  const orgId = data.organizations?.[0]?.id ?? null;
  cachedOrgId = orgId;
  return orgId;
}

type NeonUsageFields = {
  consumption_period_start: string;
  consumption_period_end: string;
  compute_time_seconds?: number;
  synthetic_storage_size?: number;
  data_transfer_bytes?: number;
};

// Neon's project list doesn't include usage, so each estimate is one extra request.
// Cache them briefly and cap concurrency so a picker with many projects stays quick.
const ESTIMATE_TTL_MS = 5 * 60 * 1000;
const ESTIMATE_CONCURRENCY = 6;
const estimateCache = new Map<string, { usd: number; at: number }>();

async function cachedEstimateUsd(neonProjectId: string): Promise<number | null> {
  const hit = estimateCache.get(neonProjectId);
  if (hit && Date.now() - hit.at < ESTIMATE_TTL_MS) return hit.usd;
  try {
    const usd = (await getNeonProjectCostEstimate(neonProjectId)).totalUsd;
    estimateCache.set(neonProjectId, { usd, at: Date.now() });
    return usd;
  } catch (err) {
    console.error(`[neon] cost estimate failed for ${neonProjectId}`, err);
    return null;
  }
}

export async function listNeonProjects(): Promise<NeonProjectOption[]> {
  const orgId = await getOrgId();
  const query = orgId ? `?org_id=${orgId}&limit=100` : "?limit=100";
  const data = await neonFetch(`/projects${query}`);
  const projects: { id: string; name: string }[] = data.projects ?? [];

  // One account-wide usage call gives exact figures for every project; fall back to per-project estimates.
  const usage = await getNeonAccountUsage().catch(() => null);
  if (usage) {
    return projects.map((p) => ({ id: p.id, name: p.name, estimateUsd: usage.projects.get(p.id)?.totalUsd ?? 0 }));
  }

  const results: NeonProjectOption[] = new Array(projects.length);
  let next = 0;
  async function worker() {
    while (next < projects.length) {
      const index = next++;
      const p = projects[index];
      results[index] = { id: p.id, name: p.name, estimateUsd: await cachedEstimateUsd(p.id) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(ESTIMATE_CONCURRENCY, projects.length) }, worker));
  return results;
}

export async function getNeonProjectCostEstimate(
  neonProjectId: string
): Promise<NeonCostEstimate> {
  const data = await neonFetch(`/projects/${neonProjectId}`);
  return estimateFromUsage(data.project);
}

function estimateFromUsage(project: NeonUsageFields): NeonCostEstimate {
  const periodStart = new Date(project.consumption_period_start).getTime();
  const periodEnd = new Date(project.consumption_period_end).getTime();
  const now = Date.now();
  const elapsedFraction = Math.min(
    1,
    Math.max(0, (now - periodStart) / (periodEnd - periodStart))
  );

  const computeHours = (project.compute_time_seconds ?? 0) / 3600;
  const computeUsd = computeHours * COMPUTE_USD_PER_CU_HOUR;

  const storageGb = (project.synthetic_storage_size ?? 0) / 1_000_000_000;
  const storageUsd = storageGb * STORAGE_USD_PER_GB_MONTH * elapsedFraction;

  const transferGb = (project.data_transfer_bytes ?? 0) / 1_000_000_000;
  const transferUsd = Math.max(0, transferGb - TRANSFER_FREE_GB) * TRANSFER_USD_PER_GB;

  return {
    totalUsd: Number((computeUsd + storageUsd + transferUsd).toFixed(2)),
    computeUsd: Number(computeUsd.toFixed(2)),
    storageUsd: Number(storageUsd.toFixed(2)),
    transferUsd: Number(transferUsd.toFixed(2)),
    periodStart: project.consumption_period_start,
    periodEnd: project.consumption_period_end,
  };
}

/* ---------------- Account-wide usage (all projects) ---------------- */

export type NeonProjectUsage = { computeUsd: number; storageUsd: number; restoreUsd: number; totalUsd: number };

export type NeonAccountUsage = {
  periodStart: string;
  totalUsd: number;
  computeUsd: number;
  storageUsd: number;
  restoreUsd: number;
  transferUsd: number;
  projectCount: number;
  projects: Map<string, NeonProjectUsage>;
};

type ConsumptionResponse = {
  projects: {
    project_id: string;
    periods: {
      period_start: string;
      consumption: { metrics: { metric_name: string; value: number }[] }[];
    }[];
  }[];
  pagination?: { cursor?: string } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Real usage for every project in the account this billing period, from Neon's consumption history (v2),
 * priced with the Launch plan rates above. Matches the Neon dashboard to within a few cents.
 */
export async function getNeonAccountUsage(): Promise<NeonAccountUsage> {
  const orgId = await getOrgId();
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const metrics = [
    "compute_unit_seconds",
    "root_branch_bytes_month",
    "child_branch_bytes_month",
    "instant_restore_bytes_month",
    "public_network_transfer_bytes",
  ].join(",");

  const totals = new Map<string, Record<string, number>>();
  let periodStart = from.toISOString();
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: "daily",
      limit: "100",
      metrics,
      ...(orgId ? { org_id: orgId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const data = (await neonFetch(`/consumption_history/v2/projects?${params}`)) as ConsumptionResponse;
    for (const project of data.projects ?? []) {
      const sums = totals.get(project.project_id) ?? {};
      for (const period of project.periods) {
        periodStart = period.period_start ?? periodStart;
        for (const day of period.consumption) {
          for (const m of day.metrics) sums[m.metric_name] = (sums[m.metric_name] ?? 0) + m.value;
        }
      }
      totals.set(project.project_id, sums);
    }
    cursor = data.pagination?.cursor;
    if (!cursor || (data.projects ?? []).length < 100) break;
  }

  const projects = new Map<string, NeonProjectUsage>();
  let computeUsd = 0;
  let storageUsd = 0;
  let restoreUsd = 0;
  let transferGb = 0;
  for (const [id, m] of totals) {
    const compute = ((m.compute_unit_seconds ?? 0) / 3600) * COMPUTE_USD_PER_CU_HOUR;
    const storage = (((m.root_branch_bytes_month ?? 0) + (m.child_branch_bytes_month ?? 0)) / GIB) * STORAGE_USD_PER_GB_MONTH;
    const restore = ((m.instant_restore_bytes_month ?? 0) / GIB) * RESTORE_USD_PER_GB_MONTH;
    transferGb += (m.public_network_transfer_bytes ?? 0) / 1_000_000_000;
    computeUsd += compute;
    storageUsd += storage;
    restoreUsd += restore;
    projects.set(id, { computeUsd: round2(compute), storageUsd: round2(storage), restoreUsd: round2(restore), totalUsd: round2(compute + storage + restore) });
  }
  // The free transfer allowance applies to the whole account.
  const transferUsd = Math.max(0, transferGb - TRANSFER_FREE_GB) * TRANSFER_USD_PER_GB;

  return {
    periodStart,
    totalUsd: round2(computeUsd + storageUsd + restoreUsd + transferUsd),
    computeUsd: round2(computeUsd),
    storageUsd: round2(storageUsd + restoreUsd),
    restoreUsd: round2(restoreUsd),
    transferUsd: round2(transferUsd),
    projectCount: totals.size,
    projects,
  };
}
