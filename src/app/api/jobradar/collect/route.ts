import { collectForAllUsers } from "@/lib/jobradar/collector";

// Called by Vercel Cron (GET, Authorization header injected from CRON_SECRET)
// every 15 minutes during the 17:00-23:45 UTC evening window. Each invocation
// is a short "pulse": it processes as many searches as fit in the time budget
// and returns how many remain — the next pulse continues exactly where it
// stopped. POST is kept for manual/local testing with curl.
async function handleScrape(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Single user app: one pulse for the profile owner covers the queue
  const summaries = await collectForAllUsers({ timeBudgetMs: 200_000, maxPulses: 1 });

  return Response.json({ summaries });
}

export const GET = handleScrape;
export const POST = handleScrape;
