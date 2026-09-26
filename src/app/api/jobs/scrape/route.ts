import { scrapeAndSaveOffersForAllUsers } from "@/lib/job-matcher";

// Called by Vercel Cron (GET, with an Authorization header Vercel injects
// automatically from the project's CRON_SECRET env var) on a schedule — see
// vercel.json. POST is kept for manual/local testing with curl. Never called
// from a page or a logged-in browser session; see scripts/scrape-jobs.ts for
// the equivalent standalone-script entry point.
async function handleScrape(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summaries = await scrapeAndSaveOffersForAllUsers();

  return Response.json({ summaries });
}

export const GET = handleScrape;
export const POST = handleScrape;
