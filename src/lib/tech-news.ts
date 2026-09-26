import { prisma } from "@/lib/prisma";
import { fetchGithubActivity, type GithubActivityItem } from "@/lib/github-trending";

export type NewsFetchSummary = {
  userId: string;
  skillsSearched: number;
  itemsFound: number;
  itemsSaved: number;
};

/**
 * For a single user: fetch recently-updated GitHub repos once per configured skill,
 * merge/dedupe by URL (tagging each item with the first skill that found it), and
 * save any items not already stored for this user.
 */
export async function fetchAndSaveTechNewsForUser(
  userId: string,
  skills: string[]
): Promise<NewsFetchSummary> {
  const foundByUrl = new Map<string, GithubActivityItem & { tag: string }>();

  for (const skill of skills) {
    try {
      const items = await fetchGithubActivity(skill);
      for (const item of items) {
        if (!foundByUrl.has(item.url)) {
          foundByUrl.set(item.url, { ...item, tag: skill });
        }
      }
    } catch (err) {
      console.error(`[tech-news] failed searching skill "${skill}" for user ${userId}:`, err);
    }
  }

  const found = Array.from(foundByUrl.values());

  const result = await prisma.techNews.createMany({
    data: found.map((item) => ({
      userId,
      title: item.title,
      url: item.url,
      source: "github",
      description: item.description,
      publishedDate: item.publishedDate,
      tags: [item.tag],
    })),
    skipDuplicates: true,
  });

  await prisma.user.update({ where: { id: userId }, data: { newsFetchedAt: new Date() } });

  return {
    userId,
    skillsSearched: skills.length,
    itemsFound: found.length,
    itemsSaved: result.count,
  };
}

/**
 * Runs the fetch for every user who has at least one skill configured.
 * Intended to be called from a scheduled script or a bearer-token-protected route,
 * never from a browser request.
 */
export async function fetchAndSaveTechNewsForAllUsers(): Promise<NewsFetchSummary[]> {
  const users = await prisma.user.findMany({
    where: { skills: { isEmpty: false } },
    select: { id: true, skills: true },
  });

  const summaries: NewsFetchSummary[] = [];
  for (const user of users) {
    summaries.push(await fetchAndSaveTechNewsForUser(user.id, user.skills));
  }
  return summaries;
}

const REFRESH_MIN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * The Refresh button on /news: fetch for one user now.
 * Returns null when the user refreshed less than 2 minutes ago (GitHub search has tight rate limits).
 */
export async function refreshTechNewsForUser(userId: string): Promise<NewsFetchSummary | "too-soon" | "no-skills"> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true, newsFetchedAt: true } });
  if (!user || user.skills.length === 0) return "no-skills";
  if (user.newsFetchedAt && Date.now() - user.newsFetchedAt.getTime() < REFRESH_MIN_INTERVAL_MS) return "too-soon";
  return fetchAndSaveTechNewsForUser(userId, user.skills);
}
