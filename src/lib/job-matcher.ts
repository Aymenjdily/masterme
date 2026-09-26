import { prisma } from "@/lib/prisma";
import { scrapeLinkedInOffers } from "@/lib/scraper-linkedin";

export type ScrapeSummary = {
  userId: string;
  skillsSearched: number;
  offersFound: number;
  offersSaved: number;
};

/**
 * For a single user: search LinkedIn once per configured skill, merge/dedupe the
 * results by URL, and save any offers not already stored for this user.
 */
export async function scrapeAndSaveOffersForUser(
  userId: string,
  skills: string[]
): Promise<ScrapeSummary> {
  const foundByUrl = new Map<string, Awaited<ReturnType<typeof scrapeLinkedInOffers>>[number]>();

  for (const skill of skills) {
    try {
      const offers = await scrapeLinkedInOffers(skill);
      for (const offer of offers) {
        if (!foundByUrl.has(offer.url)) {
          foundByUrl.set(offer.url, offer);
        }
      }
    } catch (err) {
      console.error(`[job-matcher] failed searching skill "${skill}" for user ${userId}:`, err);
    }
  }

  const found = Array.from(foundByUrl.values());

  const result = await prisma.jobOffer.createMany({
    data: found.map((offer) => ({
      userId,
      title: offer.title,
      company: offer.company,
      location: offer.location,
      source: "linkedin",
      url: offer.url,
      postedDate: offer.postedDate,
      status: "new",
    })),
    skipDuplicates: true,
  });

  return {
    userId,
    skillsSearched: skills.length,
    offersFound: found.length,
    offersSaved: result.count,
  };
}

/**
 * Runs the scrape for every user who has at least one skill configured.
 * Intended to be called from a scheduled script or a bearer-token-protected route,
 * never from a browser request.
 */
export async function scrapeAndSaveOffersForAllUsers(): Promise<ScrapeSummary[]> {
  const users = await prisma.user.findMany({
    where: { skills: { isEmpty: false } },
    select: { id: true, skills: true },
  });

  const summaries: ScrapeSummary[] = [];
  for (const user of users) {
    summaries.push(await scrapeAndSaveOffersForUser(user.id, user.skills));
  }
  return summaries;
}
