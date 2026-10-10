import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectPendingSearches } from "@/lib/jobradar/collector";

// Browser-facing manual trigger for "Get current jobs" (user session, NOT the
// CRON_SECRET bearer). Each POST is one short pulse — the client keeps
// calling until `remainingSearches` reaches 0, so no single request risks the
// serverless time limit, and a closed tab loses nothing (pending Apify runs
// are resumed by the next pulse, cron or manual).
export const maxDuration = 240;

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = Boolean(process.env.APIFY_TOKEN);
  if (!configured) {
    return Response.json({ error: "APIFY_TOKEN missing on the server" }, { status: 400 });
  }

  const summary = await collectPendingSearches(session.user.id, {
    trigger: "manual",
    timeBudgetMs: 200_000,
  });

  return Response.json({
    processed: summary.processed,
    remainingSearches: summary.remainingSearches,
    resultsRetrieved: summary.resultsRetrieved,
    newJobs: summary.newJobs,
    status: summary.status,
    note: summary.note ?? null,
  });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const running = await prisma.collectionRun.findFirst({
    where: { userId: session.user.id, status: "running" },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });
  return Response.json({ running });
}
