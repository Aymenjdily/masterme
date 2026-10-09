import * as dotenv from "dotenv";
import path from "path";
import type { MatchProfile, WeightOverrides } from "@/lib/jobradar/matcher";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

/**
 * One-off/manual: scores every unscored JobRadar job (matchScore null) with
 * the current profile. Re-run after changing profile or weights to refresh.
 */
async function main() {
  const [{ prisma }, { scoreJob }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/jobradar/matcher"),
  ]);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      skills: true,
      jobRadarConfig: {
        select: {
          profileTitle: true,
          yearsExperience: true,
          employmentTypes: true,
          titleKeywords: true,
          matchWeights: true,
        },
      },
    },
  });

  for (const user of users) {
    const config = user.jobRadarConfig;
    if (!config) continue;
    const skills =
      user.skills.filter((s) =>
        /^(react|next|node|typescript|javascript|frontend|full.?stack|nestjs|express|postgresql|mysql|tailwind|css|html|git|rest|api)/i.test(
          s.trim()
        )
      ).length > 0
        ? user.skills.filter((s) =>
            /^(react|next|node|typescript|javascript|frontend|full.?stack|nestjs|express|postgresql|mysql|tailwind|css|html|git|rest|api)/i.test(
              s.trim()
            )
          )
        : user.skills;

    const profile: MatchProfile = {
      title: config.profileTitle,
      yearsExperience: config.yearsExperience,
      skills,
      employmentTypes: config.employmentTypes,
      titleKeywords: config.titleKeywords,
      targetCountries: ["morocco", "france"],
    };

    const rescore = process.argv.includes("--all");
    const jobs = await prisma.jobOffer.findMany({
      where: {
        userId: user.id,
        source: "linkedin-apify",
        ...(rescore ? {} : { matchScore: null }),
      },
    });

    let scored = 0;
    for (const job of jobs) {
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
        (config.matchWeights as WeightOverrides) ?? undefined
      );
      await prisma.jobOffer.update({
        where: { id: job.id },
        data: {
          matchScore: match.score,
          matchReasons: match.reasons,
          technologiesMatched: match.matchedSkills,
          technologiesMissing: match.missingSkills,
        },
      });
      scored += 1;
    }
    console.log(`user ${user.id}: scored ${scored}/${jobs.length} pending jobs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
