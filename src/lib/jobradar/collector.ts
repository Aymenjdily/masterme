import { prisma } from "@/lib/prisma";
import { startActorRun, waitForRun, fetchRunItems } from "@/lib/apify-jobs";
import {
  normalizeApifyItems,
  COUNTRY_LOCATIONS,
  type TargetCountry,
} from "@/lib/jobradar/normalize";
import {
  scoreJob,
  type MatchProfile,
  type WeightOverrides,
} from "@/lib/jobradar/matcher";

/** LinkedIn Jobs Scraper actors pay ~$1 per 1,000 results at list price. */
const PRICE_PER_RESULT_USD = 0.001;
/** Runs whose latest day of interest has passed: radar jobs stay in the feed only this long. */
const PRUNE_DAYS = 7;
/** Runs older than this are considered dead; a new run may start. */
const STALE_RUN_MS = 45 * 60_000;
/** Poll until this long per search before giving up (run keeps going server-side). */
const RUN_TIMEOUT_MS = 15 * 60_000;

const DEFAULT_KEYWORDS = [
  "Full Stack Developer",
  "Full Stack Engineer",
  "Frontend Developer",
  "Frontend Engineer",
  "React Developer",
  "Next.js Developer",
  "Node.js Developer",
  "TypeScript Developer",
  "JavaScript Developer",
  "Software Engineer",
];

const ALL_COUNTRIES: TargetCountry[] = ["morocco", "france", "saudi_arabia", "uk"];

/** Default search scope: fresh listings only, matched against the 6h schedule. */
const DATE_POSTED = "past24Hours" as const;

export type CollectSummary = {
  userId: string;
  status: string;
  resultsRetrieved: number;
  newJobs: number;
  apifyUsdActual: number | null;
  apifyUsdEstimated: number;
  apifyRunIds: string[];
  note?: string;
};

import {
  zonedDayKey,
  utcMidnight,
} from "@/lib/jobradar/datetime";

/**
 * Creates the per-user config and the default Morocco/France searches.
 * Safe to call on every run; users edit limits later in Settings (P3).
 */
export async function ensureJobRadarConfig(userId: string) {
  const existing = await prisma.jobRadarConfig.findUnique({
    where: { userId },
    include: { searches: true },
  });
  if (existing) return existing;

  return prisma.jobRadarConfig.create({
    data: {
      userId,
      searches: {
        create: ALL_COUNTRIES.flatMap((country) =>
          DEFAULT_KEYWORDS.map((keyword) => ({
            userId,
            country,
            keyword,
            location: COUNTRY_LOCATIONS[country],
            limitPerSource: 25,
          }))
        ),
      },
    },
    include: { searches: true },
  });
}

function estimatedUsd(results: number): number {
  return Math.round(results * PRICE_PER_RESULT_USD * 10000) / 10000;
}

/** Builds the matcher profile from config + User.skills. */
function profileFromConfig(
  config: Awaited<ReturnType<typeof ensureJobRadarConfig>>,
  skills: string[]
): MatchProfile {
  const techSkills = skills.filter((s) =>
    /^(react|next|node|typescript|javascript|frontend|full.?stack|nestjs|express|postgresql|mysql|tailwind|css|html|git|rest|api)/i.test(
      s.trim()
    )
  );
  return {
    title: config.profileTitle,
    yearsExperience: config.yearsExperience,
    skills: techSkills.length > 0 ? techSkills : skills,
    employmentTypes: config.employmentTypes,
    titleKeywords: config.titleKeywords,
    targetCountries: ALL_COUNTRIES,
  };
}

async function monthlySpendUsd(userId: string, timezone: string): Promise<number> {
  const dayKey = zonedDayKey(new Date(), timezone);
  const monthStart = utcMidnight(`${dayKey.slice(0, 7)}-01`);
  const agg = await prisma.dailyUsage.aggregate({
    where: { userId, day: { gte: monthStart } },
    _sum: { apifyUsd: true },
  });
  return agg._sum.apifyUsd ?? 0;
}

async function countryRemainingUsable(
  userId: string,
  country: TargetCountry,
  quota: number,
  timezone: string
): Promise<number> {
  const dayKey = utcMidnight(zonedDayKey(new Date(), timezone));
  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_country_day: { userId, country, day: dayKey } },
  });
  return Math.max(0, quota - (usage?.resultsRetrieved ?? 0));
}

/**
 * Runs the collection for one user: Morocco and France searches, per-country
 * daily quotas enforced server-side before and during the run, monthly budget
 * checked before every search. Every outcome is logged to CollectionRun.
 */
export async function collectForUser(
  userId: string,
  { trigger = "cron" }: { trigger?: "cron" | "manual" } = {}
): Promise<CollectSummary> {
  const config = await ensureJobRadarConfig(userId);

  const summary: CollectSummary = {
    userId,
    status: "success",
    resultsRetrieved: 0,
    newJobs: 0,
    apifyUsdActual: null,
    apifyUsdEstimated: 0,
    apifyRunIds: [],
  };
  // Accumulates known run costs; written to summary at the end because any
  // unknown-cost run forces apifyUsdActual=null overall.
  let actualSpent = 0;

  if (!config.collectEnabled) {
    const run = await prisma.collectionRun.create({
      data: { userId, trigger, status: "skipped", note: "collect disabled" },
    });
    return { ...summary, status: "skipped", note: `collect disabled (run ${run.id})` };
  }

  // Overlap guard: a recent still-running run means another trigger is working
  const activeRun = await prisma.collectionRun.findFirst({
    where: {
      userId,
      status: "running",
      startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) },
    },
    select: { id: true },
  });
  if (activeRun) {
    const run = await prisma.collectionRun.create({
      data: { userId, trigger, status: "skipped", note: "overlapping run in progress" },
    });
    return {
      ...summary,
      status: "skipped",
      note: `overlapping run in progress (run ${run.id})`,
    };
  }

  const budgetLimitUsd =
    config.monthlyBudgetUsd * (1 - config.budgetMarginPct / 100);
  const spendBefore = await monthlySpendUsd(userId, config.timezone);
  if (spendBefore >= budgetLimitUsd) {
    const run = await prisma.collectionRun.create({
      data: {
        userId,
        trigger,
        status: "skipped",
        note: `budget reached: $${spendBefore.toFixed(2)} of $${budgetLimitUsd.toFixed(2)} limit`,
      },
    });
    return {
      ...summary,
      status: "skipped",
      note: `budget reached (run ${run.id})`,
    };
  }

  const notes: string[] = [];
  let realSpendThisRun = 0;
  let hadUnknownCost = false;
  let anyFailure = false;

  const run = await prisma.collectionRun.create({
    data: { userId, trigger, status: "running" },
  });

  // Feed freshness: untracked radar jobs older than the prune window leave the
  // feed (tracked statuses survive — they are part of application history).
  const pruned = await prisma.jobOffer.deleteMany({
    where: {
      userId,
      source: "linkedin-apify",
      status: "new",
      scrapedDate: { lt: new Date(Date.now() - PRUNE_DAYS * 86_400_000) },
    },
  });
  if (pruned.count > 0) notes.push(`pruned ${pruned.count} old listings`);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true } });
    const profile = profileFromConfig(config, user?.skills ?? []);

    const searches = config.searches
      .filter((s) => s.enabled)
      .sort((a, b) => a.country.localeCompare(b.country));

    for (const search of searches) {
      const country = search.country as TargetCountry;
      if (!ALL_COUNTRIES.includes(country)) continue;

      const quotaFor = {
        morocco: config.dailyQuotaMorocco,
        france: config.dailyQuotaFrance,
        saudi_arabia: config.dailyQuotaSaudi,
        uk: config.dailyQuotaUk,
      } as Record<TargetCountry, number>;

      // Quota + budget re-checked before every search — the run stops early
      const remaining = await countryRemainingUsable(userId, country, quotaFor[country], config.timezone);
      if (remaining === 0) {
        notes.push(`${country} daily quota reached`);
        continue;
      }
      const spendNow = spendBefore + realSpendThisRun;
      if (spendNow >= budgetLimitUsd) {
        notes.push("budget limit reached, stopping run");
        break;
      }

      const limit = Math.min(search.limitPerSource, remaining);
      if (limit <= 0) continue;

      try {
        const runInfo = await runActorAndWait({
          keywords: search.keyword,
          location: search.location,
          datePosted: DATE_POSTED,
          limitPerSource: limit,
        });
        summary.apifyRunIds.push(runInfo.runId);

        if (runInfo.status !== "SUCCEEDED") {
          anyFailure = true;
          notes.push(`${country}/${search.keyword}: run ${runInfo.status}`);
          continue;
        }

        const normalized = normalizeApifyItems(runInfo.items, country);
        const created = await persistJobs(
          userId,
          normalized.map((job) => {
            const match = scoreJob(
              {
                title: job.title,
                country: job.country,
                workplaceType: job.workplaceType,
                employmentType: job.employmentType,
                postedDate: job.postedDate,
                technologies: job.technologies,
                description: job.description,
              },
              profile,
              config.matchWeights as WeightOverrides | null ?? undefined
            );
            return { ...job, ...match };
          })
        );
        const costEstimate = estimatedUsd(runInfo.items.length);

        summary.resultsRetrieved += runInfo.items.length;
        summary.newJobs += created;
        summary.apifyUsdEstimated += costEstimate;
        if (runInfo.costTotalUsd !== null) {
          actualSpent += runInfo.costTotalUsd;
          realSpendThisRun += runInfo.costTotalUsd;
        } else {
          hadUnknownCost = true;
          realSpendThisRun += costEstimate;
        }

        await bumpDailyUsage({
          userId,
          country,
          timezone: config.timezone,
          resultsRetrieved: runInfo.items.length,
          newJobs: created,
          usd: runInfo.costTotalUsd ?? costEstimate,
        });
      } catch (err) {
        anyFailure = true;
        notes.push(
          `${country}/${search.keyword}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } finally {
    await prisma.collectionRun.update({
      where: { id: run.id },
      data: {
        status: anyFailure ? "failed" : "success",
        apifyRunIds: summary.apifyRunIds,
        resultsRetrieved: summary.resultsRetrieved,
        newJobs: summary.newJobs,
        apifyUsd: hadUnknownCost ? null : actualSpent,
        note: notes.length > 0 ? notes.join(" | ") : null,
        finishedAt: new Date(),
      },
    });
  }

  summary.note = notes.length > 0 ? notes.join(" | ") : undefined;
  summary.apifyUsdActual = hadUnknownCost ? null : actualSpent;
  return summary;
}

/** Starts + waits + fetches items for a single search. */
async function runActorAndWait(input: {
  keywords: string;
  location: string;
  datePosted: typeof DATE_POSTED;
  limitPerSource: number;
}): Promise<{ runId: string; status: string | null; items: unknown[]; costTotalUsd: number | null }> {
  const runId = await startActorRun(input);
  const finished = await waitForRun(runId, { timeoutMs: RUN_TIMEOUT_MS });
  if (!finished) {
    return { runId, status: "TIMED_OUT_LOCAL", items: [], costTotalUsd: null };
  }
  const items =
    finished.status === "SUCCEEDED" && finished.defaultDatasetId
      ? await fetchRunItems(finished.defaultDatasetId)
      : [];
  return {
    runId: finished.id,
    status: finished.status,
    items,
    costTotalUsd: finished.costTotalUsd ?? null,
  };
}

async function persistJobs(
  userId: string,
  jobs: (ReturnType<typeof normalizeApifyItems>[number] & {
    score: number;
    reasons: string[];
    matchedSkills: string[];
    missingSkills: string[];
  })[]
) {
  if (jobs.length === 0) return 0;
  const result = await prisma.jobOffer.createMany({
    data: jobs.map((job) => ({
      userId,
      title: job.title,
      company: job.company,
      location: job.location,
      source: "linkedin-apify",
      url: job.url,
      externalId: job.externalId,
      country: job.country,
      workplaceType: job.workplaceType,
      employmentType: job.employmentType,
      description: job.description,
      salary: job.salary,
      postedDate: job.postedDate,
      technologies: job.technologies,
      matchScore: job.score,
      matchReasons: job.reasons,
      technologiesMatched: job.matchedSkills,
      technologiesMissing: job.missingSkills,
      status: "new",
    })),
    skipDuplicates: true,
  });
  return result.count;
}

async function bumpDailyUsage({
  userId,
  country,
  timezone,
  resultsRetrieved,
  newJobs,
  usd,
}: {
  userId: string;
  country: TargetCountry;
  timezone: string;
  resultsRetrieved: number;
  newJobs: number;
  usd: number;
}) {
  const day = utcMidnight(zonedDayKey(new Date(), timezone));
  await prisma.dailyUsage.upsert({
    where: { userId_country_day: { userId, country, day } },
    create: { userId, country, day, resultsRetrieved, newJobs, runs: 1, apifyUsd: usd },
    update: {
      resultsRetrieved: { increment: resultsRetrieved },
      newJobs: { increment: newJobs },
      runs: { increment: 1 },
      apifyUsd: { increment: usd },
    },
  });
}

/**
 * Runs the collection for every user with a JobRadar config (creating it on
 * first run). Intended for the cron route and the manual script only — never
 * the browser request path.
 */
export async function collectForAllUsers(): Promise<CollectSummary[]> {
  const users = await prisma.user.findMany({ select: { id: true } });
  const summaries: CollectSummary[] = [];
  for (const user of users) {
    summaries.push(await collectForUser(user.id));
  }
  return summaries;
}
