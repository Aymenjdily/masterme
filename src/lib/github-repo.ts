// Server-only. Reads a public GitHub repo for the AI: description, topics, created year, README and dependencies.

const TIMEOUT_MS = 6000;
const MAX_README_CHARS = 8000;

export type RepoRead = {
  fullName: string;
  htmlUrl: string;
  description: string | null;
  topics: string[];
  createdYear: string | null;
  homepage: string | null;
  language: string | null;
  readme: string | null;
  dependencies: string[];
};

/** "https://github.com/owner/repo(.git)(/…)" or "owner/repo" → { owner, repo } */
export function parseRepo(raw: string): { owner: string; repo: string } | null {
  const m = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function gh(path: string, accept = "application/vnd.github+json") {
  const headers: Record<string, string> = { Accept: accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "MasterMe" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`https://api.github.com${path}`, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function readRepo(raw: string): Promise<RepoRead> {
  const parsed = parseRepo(raw);
  if (!parsed) throw new Error("That doesn't look like a GitHub repo link.");
  const base = `/repos/${parsed.owner}/${parsed.repo}`;

  const res = await gh(base);
  if (res.status === 404) throw new Error("GitHub repo not found (or it's private).");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  const repo = (await res.json()) as {
    full_name: string;
    html_url: string;
    description: string | null;
    topics?: string[];
    created_at?: string;
    homepage?: string | null;
    language?: string | null;
  };

  const [readmeRes, pkgRes] = await Promise.all([
    gh(`${base}/readme`, "application/vnd.github.raw+json").catch(() => null),
    gh(`${base}/contents/package.json`, "application/vnd.github.raw+json").catch(() => null),
  ]);
  const readme = readmeRes?.ok ? (await readmeRes.text()).slice(0, MAX_README_CHARS) : null;

  let dependencies: string[] = [];
  if (pkgRes?.ok) {
    try {
      const pkg = JSON.parse(await pkgRes.text()) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      dependencies = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    } catch {
      // Not valid JSON: ignore dependencies.
    }
  }

  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    topics: repo.topics ?? [],
    createdYear: repo.created_at ? repo.created_at.slice(0, 4) : null,
    homepage: repo.homepage || null,
    language: repo.language ?? null,
    readme,
    dependencies,
  };
}
