import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { fetchAndSaveTechNewsForAllUsers, refreshTechNewsForUser } from "@/lib/tech-news";

function isCron(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return !!process.env.CRON_SECRET && request.headers.get("authorization") === expected;
}

// Called daily by Vercel Cron (GET, with the Authorization header Vercel injects from CRON_SECRET;
// see vercel.json). See scripts/fetch-tech-news.ts for the standalone-script entry point.
export async function GET(request: Request) {
  if (!isCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ summaries: await fetchAndSaveTechNewsForAllUsers() });
}

// POST with the CRON_SECRET bearer: every user (manual runs with curl).
// POST from the signed-in browser: the Refresh button on /news, for that user only.
export async function POST(request: Request) {
  if (isCron(request)) {
    return Response.json({ summaries: await fetchAndSaveTechNewsForAllUsers() });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshTechNewsForUser(session.user.id);
  if (result === "no-skills") {
    return Response.json({ error: "Add your stack in Settings first." }, { status: 400 });
  }
  if (result === "too-soon") {
    return Response.json({ error: "Just refreshed. Try again in a couple of minutes." }, { status: 429 });
  }
  return Response.json(result);
}
