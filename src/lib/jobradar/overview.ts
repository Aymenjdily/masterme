import { prisma } from "@/lib/prisma";
import { utcMidnight, utcMidnightToday, zonedDayKey } from "@/lib/jobradar/datetime";
import { ensureJobRadarConfig } from "@/lib/jobradar/collector";

/**
 * Computes the JobRadar overview: feed stats, quota usage, month spend and
 * recent runs. Server-only helper used by /api/jobradar/overview.
 */
export async function getJobRadarOverview(userId: string) {
  const config = await ensureJobRadarConfig(userId);
  const today = utcMidnightToday(config.timezone);

  const [discoveredToday, perCountry, highScore, newJobs, monthUsage, runs, totals] =
    await Promise.all([
      prisma.jobOffer.count({
        where: {
          userId,
          source: "linkedin-apify",
          scrapedDate: { gte: today },
        },
      }),
      prisma.jobOffer.groupBy({
        by: ["country"],
        where: { userId, source: "linkedin-apify" },
        _count: true,
      }),
      prisma.jobOffer.count({
        where: { userId, source: "linkedin-apify", matchScore: { gte: 80 } },
      }),
      prisma.jobOffer.count({
        where: { userId, source: "linkedin-apify", status: "new" },
      }),
      prisma.dailyUsage.groupBy({
        by: ["country"],
        where: { userId, day: { gte: utcMidnightFirstOfMonth(config.timezone) } },
        _sum: { apifyUsd: true, resultsRetrieved: true, newJobs: true },
      }),
      prisma.collectionRun.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: 6,
      }),
      // Application-side stats reuse of radar jobs
      prisma.jobOffer.groupBy({
        by: ["status"],
        where: { userId, source: "linkedin-apify" },
        _count: true,
      }),
    ]);

  const usageToday = await prisma.dailyUsage.findMany({
    where: { userId, day: today },
  });

  const perCount = (key: string) => perCountry.find((r) => r.country === key)?._count ?? 0;
  const usedToday = (key: string) =>
    usageToday.find((u) => u.country === key)?.resultsRetrieved ?? 0;

  const moroccoJobs = perCount("morocco");
  const franceJobs = perCount("france");
  const saudiJobs = perCount("saudi_arabia");
  const ukJobs = perCount("uk");
  const monthSpend = monthUsage.reduce((sum, r) => sum + (r._sum.apifyUsd ?? 0), 0);

  const statusCounts: Record<string, number> = {};
  for (const row of totals) statusCounts[row.status] = row._count;

  const budgetLimit =
    config.monthlyBudgetUsd * (1 - config.budgetMarginPct / 100);

  return {
    config: {
      dailyQuotaMorocco: config.dailyQuotaMorocco,
      dailyQuotaFrance: config.dailyQuotaFrance,
      dailyQuotaSaudi: config.dailyQuotaSaudi,
      dailyQuotaUk: config.dailyQuotaUk,
      monthlyBudgetUsd: config.monthlyBudgetUsd,
      budgetMarginPct: config.budgetMarginPct,
      matchThreshold: config.matchThreshold,
      collectEnabled: config.collectEnabled,
      timezone: config.timezone,
      profileTitle: config.profileTitle,
      yearsExperience: config.yearsExperience,
      employmentTypes: config.employmentTypes,
      titleKeywords: config.titleKeywords,
    },
    stats: {
      discoveredToday,
      moroccoJobs,
      franceJobs,
      saudiJobs,
      ukJobs,
      highScore,
      newJobs,
      statusCounts,
    },
    quota: {
      morocco: { used: usedToday("morocco"), limit: config.dailyQuotaMorocco },
      france: { used: usedToday("france"), limit: config.dailyQuotaFrance },
      saudi: { used: usedToday("saudi_arabia"), limit: config.dailyQuotaSaudi },
      uk: { used: usedToday("uk"), limit: config.dailyQuotaUk },
    },
    spend: {
      monthUsd: Math.round(monthSpend * 10000) / 10000,
      budgetLimitUsd: Math.round(budgetLimit * 100) / 100,
      budgetUsd: config.monthlyBudgetUsd,
      byCountry: monthUsage.map((r) => ({
        country: r.country,
        results: r._sum.resultsRetrieved ?? 0,
        newJobs: r._sum.newJobs ?? 0,
        usd: r._sum.apifyUsd ?? 0,
      })),
    },
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      resultsRetrieved: r.resultsRetrieved,
      newJobs: r.newJobs,
      apifyUsd: r.apifyUsd,
      note: r.note,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
    })),
    todayKey: zonedDayKey(new Date(), config.timezone),
  };
}

function utcMidnightFirstOfMonth(timezone: string): Date {
  const dayKey = zonedDayKey(new Date(), timezone);
  return utcMidnight(`${dayKey.slice(0, 7)}-01`);
}
