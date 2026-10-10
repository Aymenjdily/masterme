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
import { utcMidnight, zonedDayKey } from "@/lib/jobradar/datetime";

/** LinkedIn Jobs Scraper actors pay ~$1 per 1,000 results at list price. */
const PRICE_PER_RESULT_USD = 0.001;
/** Runs older than this are considered dead; a new run may start. */
const STALE_RUN_MS = 45 * 60_000;
/** Feed freshness. */
const PRUNE_DAYS = 7;

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

/** Default search scope: fresh listings only, matched against the daily schedule. */
const DATE_POSTED = "past24Hours" as const;

export type CollectSummary = {
  userId: string;
  status: string;
  resultsRetrieved: number;
  newJobs: number;
  apifyUsdActual: number | null;
  apifyUsdEstimated: number;
  processed: number;
  remainingSearches: number;
  note?: string;
};

/**
 * Creates the per-user config and the default searches (one per keyword per
 * country). Safe to call on every run; missing default searches (e.g. a new
 * target country) are appended without touching user-edited rows.
 */
export async function ensureJobRadarConfig(userId: string) {
  const existing = await prisma.jobRadarConfig.findUnique({
    where: { userId },
    include: { searches: true },
  });

  if (!existing) {
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

  const have = new Set(existing.searches.map((s) => `${s.country}|${s.keyword}`));
  const missing = ALL_COUNTRIES.filter(
    (c) => !existing.searches.some((s) => s.country === c)
  );
  if (missing.length === 0) return existing;

  await prisma.jobSearch.createMany({
    data: missing.flatMap((country) =>
      DEFAULT_KEYWORDS.filter((k) => !have.has(`${country}|${k}`)).map((keyword) => ({
        userId,
        configId: existing.id,
        country,
        keyword,
        location: COUNTRY_LOCATIONS[country],
        limitPerSource: 25,
      }))
    ),
  });
  const refreshed = await prisma.jobRadarConfig.findUnique({
    where: { userId },
    include: { searches: true },
  });
  if (!refreshed) throw new Error("JobRadar config disappeared after appending searches");
  return refreshed;
}

function estimatedUsd(results: number): number {
  return Math.round(results * PRICE_PER_RESULT_USD * 10000) / 10000;
}

function quotaFor(
  config: Awaited<ReturnType<typeof ensureJobRadarConfig>>
): Record<TargetCountry, number> {
  return {
    morocco: config.dailyQuotaMorocco,
    france: config.dailyQuotaFrance,
    saudi_arabia: config.dailyQuotaSaudi,
    uk: config.dailyQuotaUk,
  };
}

async function countryRemainingUsable(
  userId: string,
  country: TargetCountry,
  quota: number,
  day: Date
): Promise<number> {
  if (quota <= 0) return 0;
  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_country_day: { userId, country, day } },
  });
  return Math.max(0, quota - (usage?.resultsRetrieved ?? 0));
}

/** Monthly spend from DailyUsage (current calendar month of the zoned day). */
async function monthlySpendUsd(userId: string, timezone: string): Promise<number> {
  const dayKey = zonedDayKey(new Date(), timezone);
  const monthStart = utcMidnight(`${dayKey.slice(0, 7)}-01`);
  const agg = await prisma.dailyUsage.aggregate({
    where: { userId, day: { gte: monthStart } },
    _sum: { apifyUsd: true },
  });
  return agg._sum.apifyUsd ?? 0;
}

async function bumpDailyUsage(
  userId: string,
  country: TargetCountry,
  day: Date,
  counters: { resultsRetrieved: number; newJobs: number; usd: number }
) {
  await prisma.dailyUsage.upsert({
    where: { userId_country_day: { userId, country, day } },
    create: {
      userId,
      country,
      day,
      resultsRetrieved: counters.resultsRetrieved,
      newJobs: counters.newJobs,
      runs: 1,
      apifyUsd: counters.usd,
    },
    update: {
      resultsRetrieved: { increment: counters.resultsRetrieved },
      newJobs: { increment: counters.newJobs },
      runs: { increment: 1 },
      apifyUsd: { increment: counters.usd },
    },
  });
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

async function persistJobs(
  userId: string,
  jobs: ReturnType<typeof normalizeApifyItems>,
  profile: MatchProfile,
  weights: WeightOverrides | null
) {
  if (jobs.length === 0) return 0;
  const result = await prisma.jobOffer.createMany({
    data: jobs.map((job) => {
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
        weights ?? undefined
      );
      return {
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
        matchScore: match.score,
        matchReasons: match.reasons,
        technologiesMatched: match.matchedSkills,
        technologiesMissing: match.missingSkills,
        status: "new",
      };
    }),
    skipDuplicates: true,
  });
  return result.count;
}

type SearchRow = Awaited<ReturnType<typeof ensureJobRadarConfig>>["searches"][number];

/**
 * Executes ONE search: polls the pending run first (a run started by a
 * previous, shorter invocation), or starts a new one — then consumes it.
 * A started-but-unconsumed run keeps pendingRunId set so its already-paid
 * results are harvested on the next pulse, never bought twice.
 */
async function runOneSearch(
  userId: string,
  search: SearchRow,
  country: TargetCountry,
  day: Date,
  budgetMsLeft: number
): Promise<
  | { ok: true; items: unknown[]; runId: string; costTotalUsd: number | null }
  | { ok: false; retry: boolean }
> {
  try {
    let runId: string | null = search.pendingRunId ?? null;
    if (budgetMsLeft < 15_000) return { ok: false, retry: true };

    if (runId) {
      console.log(`[collector] resuming pending run ${runId} for "${search.keyword}" (${country})`);
    } else {
      runId = await startActorRun({
        keywords: search.keyword,
        location: search.location,
        datePosted: DATE_POSTED,
        limitPerSource: Math.max(1, search.limitPerSource),
        scrapeCompany: false,
      });
      await prisma.jobSearch.update({
        where: { id: search.id },
        data: { pendingRunId: runId },
      });
    }

    const finished = await waitForRun(runId, { timeoutMs: Math.min(budgetMsLeft, 120_000), pollMs: 4_000 });
    if (!finished) return { ok: false, retry: true }; // keep pendingRunId for the next pulse
    if (finished.status !== "SUCCEEDED") {
      await prisma.jobSearch.update({
        where: { id: search.id },
        data: { pendingRunId: null },
      });
      console.error(`[collector] Apify run ${runId} ended ${finished.status}`);
      return { ok: false, retry: false };
    }

    const items = finished.defaultDatasetId ? await fetchRunItems(finished.defaultDatasetId) : [];
    await prisma.jobSearch.update({
      where: { id: search.id },
      data: { pendingRunId: null, lastRunAt: new Date(), lastRunDay: day },
    });
    return { ok: true, items, runId: finished.id, costTotalUsd: finished.costTotalUsd ?? null };
  } catch (err) {
    console.error(`[collector] search failed:`, err);
    return { ok: false, retry: false };
  }
}

/**
 * Runs the collector as short "pulses": each invocation executes searches
 * (one per Apify run) until the time budget is used up, then returns with a
 * count of remaining searches. Serverless-safe: an invocation can die after
 * any point without losing data or money, and subsequent pulses pick up
 * where it stopped. Used by the cron route, the manual script and the
 * browser "Get current jobs" button alike.
 */
export async function collectPendingSearches(
  userId: string,
  { trigger = "cron", timeBudgetMs = 200_000 }: { trigger?: "cron" | "manual"; timeBudgetMs?: number } = {}
): Promise<CollectSummary> {
  const config = await ensureJobRadarConfig(userId);

  const summary: CollectSummary = {
    userId,
    status: "success",
    resultsRetrieved: 0,
    newJobs: 0,
    apifyUsdActual: null,
    apifyUsdEstimated: 0,
    processed: 0,
    remainingSearches: 0,
  };

  if (!config.collectEnabled) {
    summary.status = "skipped";
    summary.note = "collect disabled";
    await countRemaining(summary, userId, config);
    return summary;
  }

  const budgetLimitUsd = config.monthlyBudgetUsd * (1 - config.budgetMarginPct / 100);
  const spendBefore = await monthlySpendUsd(userId, config.timezone);
  if (spendBefore >= budgetLimitUsd) {
    summary.status = "skipped";
    summary.note = `budget reached: $${spendBefore.toFixed(2)} of $${budgetLimitUsd.toFixed(2)} limit`;
    await countRemaining(summary, userId, config);
    return summary;
  }

  // Mark dead runs (killed invocations) so they don't block new ones
  await prisma.collectionRun.updateMany({
    where: { userId, status: "running", startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    data: { status: "failed", note: "interrupted (invocation died)", finishedAt: new Date() },
  });

  const activeRun = await prisma.collectionRun.findFirst({
    where: { userId, status: "running", startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
    select: { id: true },
  });
  if (activeRun) {
    summary.status = "skipped";
    summary.note = "overlapping run in progress";
    await countRemaining(summary, userId, config);
    return summary;
  }

  const run = await prisma.collectionRun.create({
    data: { userId, trigger, status: "running" },
  });

  const notes: string[] = [];
  let realSpend = 0;
  let hadUnknownCost = false;
  let anyFailure = false;
  const day = utcMidnight(zonedDayKey(new Date(), config.timezone));
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true } });
  const profile = profileFromConfig(config, user?.skills ?? []);
  const quotas = quotaFor(config);
  const startedAt = Date.now();

  // Freshness: untracked radar jobs older than the prune window leave the feed
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
    // Pending searches are re-read from the DB on EVERY iteration: the loop
    // mutates rows (lastRunDay, pendingRunId) and the next candidate must
    // reflect that, otherwise stale state loops forever.
    const loadPending = async () => {
      const rows = await prisma.jobSearch.findMany({
        where: { configId: config.id, enabled: true },
      });
      const todayDb = utcMidnight(zonedDayKey(new Date(), config.timezone));
      return rows
        .filter(
          (s) =>
            s.pendingRunId !== null ||
            !s.lastRunDay ||
            utcMidnight(zonedDayKey(s.lastRunDay, config.timezone)).getTime() !== todayDb.getTime()
        )
        .sort((a, b) => a.country.localeCompare(b.country) || a.keyword.localeCompare(b.keyword));
    };

    while (Date.now() - startedAt < timeBudgetMs) {
      const queue = await loadPending();
      summary.remainingSearches = queue.length;
      if (queue.length === 0) break;
      const elapsed = Date.now() - startedAt;
      const msLeft = timeBudgetMs - elapsed;

      const search = queue[0];
      const country = search.country as TargetCountry;
      if (!ALL_COUNTRIES.includes(country)) {
        await prisma.jobSearch.update({
          where: { id: search.id },
          data: { lastRunDay: day },
        });
        continue;
      }

      const remaining = await countryRemainingUsable(userId, country, quotas[country], day);
      const spendNow = spendBefore + realSpend;
      if (remaining === 0) {
        notes.push(`${country} daily quota reached`);
        await prisma.jobSearch.update({
          where: { id: search.id },
          data: { lastRunDay: day },
        });
        continue;
      }
      if (spendNow >= budgetLimitUsd) {
        notes.push("budget limit reached, stopping run");
        break;
      }

      const limit = Math.min(search.limitPerSource, remaining);
      const outcome = await runOneSearch(
        userId,
        { ...search, limitPerSource: limit },
        country,
        day,
        msLeft
      );
      if (!outcome.ok) {
        if (outcome.retry) {
          notes.push(`out of time while waiting for "${search.keyword}" — next pulse resumes it`);
          summary.remainingSearches = queue.length;
          break;
        }
        anyFailure = true;
        notes.push(`${country}/${search.keyword}: run failed`);
        summary.processed += 1;
        continue;
      }
      summary.processed += 1;

      const { items, costTotalUsd } = outcome;
      const normalized = normalizeApifyItems(items, country);
      const created = await persistJobs(
        userId,
        normalized,
        profile,
        config.matchWeights as WeightOverrides | null
      );
      const costEstimate = estimatedUsd(items.length);

      summary.resultsRetrieved += items.length;
      summary.newJobs += created;
      summary.apifyUsdEstimated += costEstimate;
      if (costTotalUsd !== null) {
        realSpend += costTotalUsd;
      } else {
        hadUnknownCost = true;
        realSpend += costEstimate;
      }

      await bumpDailyUsage(userId, country, day, {
        resultsRetrieved: items.length,
        newJobs: created,
        usd: costTotalUsd ?? costEstimate,
      });

      if (remaining - items.length <= 0) notes.push(`${country} daily quota reached`);
    }

    summary.remainingSearches = (await loadPending()).length;
    summary.note =
      [...notes, summary.remainingSearches > 0 ? `remaining searches today: ${summary.remainingSearches}` : null]
        .filter((v): v is string => v !== null)
        .join(" | ") || undefined;
  } finally {
    await prisma.collectionRun.update({
      where: { id: run.id },
      data: {
        status: anyFailure ? "failed" : "success",
        resultsRetrieved: summary.resultsRetrieved,
        newJobs: summary.newJobs,
        apifyUsd: hadUnknownCost ? null : realSpend,
        note:
          [
            ...notes,
            summary.remainingSearches > 0 ? `remaining searches today: ${summary.remainingSearches}` : null,
          ]
            .filter((v): v is string => v !== null)
            .join(" | ") || null,
        finishedAt: new Date(),
      },
    });
  }

  summary.apifyUsdActual = hadUnknownCost ? null : realSpend;
  return summary;
}

async function countRemaining(summary: CollectSummary, userId: string, config: Awaited<ReturnType<typeof ensureJobRadarConfig>>) {
  const searches = await prisma.jobSearch.findMany({ where: { configId: config.id, enabled: true } });
  const todayDb = utcMidnight(zonedDayKey(new Date(), config.timezone));
  summary.remainingSearches = searches.filter(
    (s) => s.pendingRunId !== null || !s.lastRunDay || utcMidnight(zonedDayKey(s.lastRunDay, config.timezone)).getTime() !== todayDb.getTime()
  ).length;
}

/**
 * Kept for the manual script (which has no serverless time limit): loops
 * pulses for every user until the day is complete.
 */
export async function collectForAllUsers(
  { timeBudgetMs = 200_000, maxPulses = 40 }: { timeBudgetMs?: number; maxPulses?: number } = {}
): Promise<CollectSummary[]> {
  const users = await prisma.user.findMany({ select: { id: true } });
  const summaries: CollectSummary[] = [];
  for (const user of users) {
    let pulse = 0;
    let last: CollectSummary | null = null;
    while (pulse < maxPulses) {
      last = await collectPendingSearches(user.id, { timeBudgetMs });
      pulse += 1;
      if (last.status === "skipped" || last.remainingSearches === 0) break;
    }
    if (last) summaries.push(last);
  }
  return summaries;
}
