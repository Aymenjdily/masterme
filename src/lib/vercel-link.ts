import { listVercelProjects } from "@/lib/vercel";

/**
 * Turns the form's Vercel project id into the fields to save:
 * undefined → no change; null or "" → unlinked; an id → linked (and counted as hosted on Vercel).
 * The id must exist in the team, and its name comes from Vercel, not from the browser.
 */
export async function resolveVercelLink(vercelProjectId: string | null | undefined) {
  if (vercelProjectId === undefined) return {};
  if (!vercelProjectId) return { vercelProjectId: null, vercelProjectName: null };
  const match = (await listVercelProjects().catch(() => [])).find((p) => p.id === vercelProjectId);
  if (!match) return "invalid" as const;
  return { vercelProjectId: match.id, vercelProjectName: match.name, vercelHosting: true };
}
