import { headers } from "next/headers";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { collectForUser } from "@/lib/jobradar/collector";

// Browser-facing manual trigger for "Get current jobs" (user session, NOT the
// CRON_SECRET bearer). The actual collection runs after this response via
// `after()` — a run can take many minutes, so nothing blocks the UI. The
// collector's own overlap guard prevents double runs with the 18:00 cron.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return immediately; reject before starting if a run would be skipped
  const hasPlatformConfigured = Boolean(process.env.APIFY_TOKEN);
  if (!hasPlatformConfigured) {
    return Response.json({ error: "APIFY_TOKEN missing on the server" }, { status: 400 });
  }

  after(async () => {
    try {
      await collectForUser(session.user.id, { trigger: "manual" });
    } catch (err) {
      console.error("[jobradar] manual collect failed:", err);
    }
  });

  return Response.json({ started: true }, { status: 202 });
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
