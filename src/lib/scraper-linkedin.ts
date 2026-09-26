import * as cheerio from "cheerio";

export type ScrapedJobOffer = {
  title: string;
  company: string;
  location: string | null;
  url: string;
  postedDate: Date | null;
};

const GUEST_SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMoroccoLocation(location: string | null): boolean {
  if (!location) return true; // LinkedIn sometimes omits location text; don't drop on absence
  const normalized = location.toLowerCase();
  if (normalized.includes("morocco") || normalized.includes("maroc")) return true;
  // Reject if it clearly names a different country (a comma-separated "City, Country" pattern)
  const knownOtherCountryHints = [
    "france",
    "united states",
    "united kingdom",
    "germany",
    "spain",
    "canada",
    "remote",
  ];
  if (knownOtherCountryHints.some((hint) => normalized.includes(hint))) return false;
  return true;
}

function parsePostedDate(relativeText: string | undefined): Date | null {
  if (!relativeText) return null;
  const match = relativeText.match(/(\d+)\s+(day|week|month|hour|minute)s?\s+ago/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const msPerUnit: Record<string, number> = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  };
  return new Date(Date.now() - amount * (msPerUnit[unit] ?? 0));
}

/**
 * Scrapes LinkedIn's public "guest" job search endpoint (no login required) for a
 * single keyword, scoped to Morocco. This is an unofficial, undocumented endpoint —
 * LinkedIn can change its markup or block requests at any time. Best-effort only.
 */
export async function scrapeLinkedInOffers(
  keyword: string,
  { pages = 1 }: { pages?: number } = {}
): Promise<ScrapedJobOffer[]> {
  const offers: ScrapedJobOffer[] = [];

  for (let page = 0; page < pages; page++) {
    const url = new URL(GUEST_SEARCH_URL);
    url.searchParams.set("keywords", keyword);
    url.searchParams.set("location", "Morocco");
    url.searchParams.set("start", String(page * 25));

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
      });
    } catch (err) {
      console.error(`[scraper-linkedin] network error for "${keyword}":`, err);
      break;
    }

    if (!res.ok) {
      console.error(
        `[scraper-linkedin] request failed for "${keyword}": ${res.status} ${res.statusText}`
      );
      break;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const cards = $("li");

    if (cards.length === 0) break;

    cards.each((_, el) => {
      const card = $(el);
      const title = card.find(".base-search-card__title").text().trim();
      const company = card.find(".base-search-card__subtitle").text().trim();
      const location = card.find(".job-search-card__location").text().trim() || null;
      const href = card.find("a.base-card__full-link").attr("href");
      const postedText = card.find("time").attr("datetime") ?? card.find("time").text().trim();

      if (!title || !company || !href) return;

      const cleanUrl = href.split("?")[0];

      if (!isMoroccoLocation(location)) return;

      offers.push({
        title,
        company,
        location,
        url: cleanUrl,
        postedDate: postedText
          ? new Date(postedText).toString() !== "Invalid Date"
            ? new Date(postedText)
            : parsePostedDate(postedText)
          : null,
      });
    });

    await sleep(750);
  }

  return offers;
}
