/**
 * Thin REST wrapper around the Apify API for the LinkedIn Jobs Scraper actor
 * (curious_coder/linkedin-jobs-scraper, actor ID hKByXkMQaC5Qt9UMN).
 *
 * Pricing (verified 2026-10): pay-per-event, $1.00 per 1,000 results at list
 * price — cost scales with results retrieved, one run does not add extra.
 * costTotalUsd is the run's charged cost when Apify reports it.
 *
 * Server-only: APIFY_TOKEN must never be imported into client code.
 */

const APIFY_API_BASE = "https://api.apify.com/v2";

export type ApifyActorInput = {
  keywords?: string;
  location?: string;
  /** URLs pointing at LinkedIn jobs search pages */
  urls?: string[];
  datePosted?: "anyTime" | "past24Hours" | "pastWeek" | "pastMonth";
  /** Max jobs per input URL / search — this is the actor-level cost cap */
  limitPerSource?: number;
  scrapeCompany?: boolean;
};

export type ApifyRunStatus = {
  id: string;
  status: string;
  costTotalUsd?: number | null;
  defaultDatasetId?: string | null;
};

/** Runs whose dataset is safe to read. */
export function isRunFinished(status: string): boolean {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED" ||
    status === "ABORTED" ||
    status === "TIMEDOUT" ||
    status === "CRASHED" ||
    status === "REQUEST_CANCELLED"
  );
}

function requireToken(): string {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not configured");
  return token;
}

/** Error text must never contain the API token, which lives in the query string. */
function redactToken(pathWithToken: string): string {
  return pathWithToken.replace(/token=[^&]+/g, "token=***");
}

async function apifyFetch(path: string, init?: RequestInit & { timeoutMs?: number }) {
  const { timeoutMs = 30_000, ...rest } = init ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${APIFY_API_BASE}${path}`, {
      ...rest,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Apify API ${res.status} on ${redactToken(path)}: ${body.slice(0, 300)}`
      );
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function validateApifyInput(input: ApifyActorInput): string[] {
  const errors: string[] = [];
  if (input.urls?.length) {
    if (input.urls.length > 20) errors.push("too many search urls in one run");
  } else if (!input.keywords?.trim()) {
    errors.push("input needs either urls or keywords");
  }
  if (input.limitPerSource !== undefined && input.limitPerSource < 0) {
    errors.push("limitPerSource must be >= 0");
  }
  return errors;
}

/** Starts the actor and returns the Apify run id (async, does not wait). */
export async function startActorRun(input: ApifyActorInput): Promise<string> {
  const token = requireToken();
  const problems = validateApifyInput(input);
  if (problems.length > 0) {
    throw new Error(`refused Apify run: ${problems.join("; ")}`);
  }

  const res = await apifyFetch(
    `/acts/curious_coder~linkedin-jobs-scraper/runs?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, scrapeCompany: false }),
    }
  );
  const payload = (await res.json()) as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error("Apify run started but no run id was returned");
  return payload.data.id;
}

/** Polls the run until it finishes or the timeout hits. */
export async function waitForRun(
  runId: string,
  { timeoutMs = 15 * 60_000, pollMs = 5_000 }: { timeoutMs?: number; pollMs?: number } = {}
): Promise<ApifyRunStatus | null> {
  const token = requireToken();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await apifyFetch(`/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
      const payload = (await res.json()) as {
        data?: { id: string; status: string; costTotalUsd?: number | null; defaultDatasetId?: string | null };
      };
      const run = payload.data;
      if (run && isRunFinished(run.status)) {
        return {
          id: run.id,
          status: run.status,
          costTotalUsd: run.costTotalUsd ?? null,
          defaultDatasetId: run.defaultDatasetId ?? null,
        };
      }
    } catch (err) {
      // Transient polling errors are tolerated until the deadline
      console.error(`[apify-jobs] poll ${runId} failed:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null; // timed out without a terminal status
}

/** Downloads all dataset items produced by a run. */
export async function fetchRunItems(datasetId: string): Promise<unknown[]> {
  if (!datasetId) return [];
  const token = requireToken();
  const res = await apifyFetch(
    `/datasets/${datasetId}/items?clean=true&token=${encodeURIComponent(token)}`,
    { timeoutMs: 60_000 }
  );
  const items = (await res.json()) as unknown;
  return Array.isArray(items) ? items : [];
}

/**
 * Full run lifecycle: start, wait, download. Returns the items plus run info.
 * On timeout the run is recorded so it can be diagnosed — the actor keeps
 * running server-side, but nothing is charged beyond its own results.
 */
export async function runActor(input: ApifyActorInput): Promise<{
  items: unknown[];
  runId: string;
  status: string | null;
  costTotalUsd: number | null;
}> {
  const runId = await startActorRun(input);
  const finished = await waitForRun(runId);
  if (!finished) {
    return { items: [], runId, status: "TIMED_OUT_LOCAL", costTotalUsd: null };
  }
  if (finished.status !== "SUCCEEDED") {
    return {
      items: [],
      runId,
      status: finished.status,
      costTotalUsd: finished.costTotalUsd ?? null,
    };
  }
  const items = finished.defaultDatasetId
    ? await fetchRunItems(finished.defaultDatasetId)
    : [];
  return {
    items,
    runId: finished.id,
    status: finished.status,
    costTotalUsd: finished.costTotalUsd ?? null,
  };
}
