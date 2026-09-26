import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { recalculateForAllUsers, recalculateForUser, recalculatedRecently } from "@/lib/infra-cost";

function isCron(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return !!process.env.CRON_SECRET && request.headers.get("authorization") === expected;
}

// Called daily by Vercel Cron (GET, with the Authorization header Vercel injects from CRON_SECRET;
// see vercel.json). Recalculates every user's Neon-linked projects. See scripts/recalc-infra.ts.
export async function GET(request: Request) {
  if (!isCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await recalculateForAllUsers());
}

// The Recalculate button on /projects: only the signed-in user's projects, at most once a minute.
// A CRON_SECRET bearer also works here, for manual runs with curl.
export async function POST(request: Request) {
  if (isCron(request)) {
    return Response.json(await recalculateForAllUsers());
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (await recalculatedRecently(session.user.id)) {
    return Response.json({ error: "Just updated. Try again in a minute." }, { status: 429 });
  }
  return Response.json(await recalculateForUser(session.user.id));
}
