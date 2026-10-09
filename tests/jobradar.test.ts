import { describe, expect, it } from "vitest";
import { scoreJob, resolveWeights, DEFAULT_WEIGHTS } from "@/lib/jobradar/matcher";
import type { MatchProfile } from "@/lib/jobradar/matcher";
import { normalizeApifyItems } from "@/lib/jobradar/normalize";

const profile: MatchProfile = {
  title: "Full-Stack Engineer",
  yearsExperience: 4,
  skills: ["React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "JavaScript"],
  employmentTypes: ["full-time", "contract", "freelance"],
  titleKeywords: ["full stack", "frontend", "software engineer", "react", "node"],
  targetCountries: ["morocco", "france"],
};

const base = {
  id: "123",
  title: "Full Stack Developer",
  companyName: "Acme",
  location: "Casablanca, Morocco",
  link: "https://www.linkedin.com/jobs/view/123",
  postedAt: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  employmentType: "Full-time",
  workRemoteAllowed: false,
  descriptionText:
    "We are looking for a full stack developer with 3 years of experience in React, TypeScript and Node.js.",
};

describe("matcher", () => {
  it("scores a strong full-stack job high", () => {
    const posted = new Date(Date.now() - 86_400_000);
    const r = scoreJob(
      {
        title: "Full Stack Engineer",
        country: "morocco",
        workplaceType: "hybrid",
        employmentType: "Full-time",
        postedDate: posted,
        technologies: ["React", "TypeScript", "Node.js"],
        description: "Join us! 2 years of experience with React required.",
      },
      profile
    );
    expect(r.score).toBeGreaterThan(70);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.matchedSkills).toContain("React");
  });

  it("scores an unrelated job low but never negative", () => {
    const r = scoreJob(
      {
        title: "Nurse Practitioner",
        country: "france",
        workplaceType: "onsite",
        employmentType: "Full-time",
        postedDate: new Date(Date.now() - 3 * 86_400_000),
        technologies: [],
        description: "Hospital care role. 5+ years of clinical experience.",
      },
      profile
    );
    expect(r.score).toBeLessThan(50);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("never rejects for missing information", () => {
    const rWithoutInfo = scoreJob(
      {
        title: "Software Engineer",
        country: null,
        workplaceType: "unknown",
        employmentType: null,
        postedDate: null,
        technologies: [],
        description: null,
      },
      profile
    );
    const r = scoreJob(
      {
        title: "Software Engineer",
        country: "morocco",
        workplaceType: "hybrid",
        employmentType: "Full-time",
        postedDate: new Date(Date.now() - 86_400_000),
        technologies: ["React"],
        description: "Some backend duties.",
      },
      profile
    );
    expect(rWithoutInfo.score).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(rWithoutInfo.score);
  });

  it("penalizes incompatible explicit experience requirements", () => {
    const demanding = scoreJob(
      {
        title: "Full Stack Developer",
        country: "morocco",
        workplaceType: "hybrid",
        employmentType: "Full-time",
        postedDate: new Date(Date.now() - 86_400_000),
        technologies: ["React"],
        description: "Requirements: 12+ years of experience.",
      },
      profile
    );
    const suitable = scoreJob(
      {
        title: "Full Stack Developer",
        country: "morocco",
        workplaceType: "hybrid",
        employmentType: "Full-time",
        postedDate: new Date(Date.now() - 86_400_000),
        technologies: ["React"],
        description: "Requirements: 2+ years of experience.",
      },
      profile
    );
    expect(demanding.score).toBeLessThan(suitable.score);
    expect(suitable.reasons.some((r) => r.includes("suitable"))).toBe(true);
  });

  it("scores France on-site lower than Morocco on-site (eligibility)", () => {
    const common = {
      title: "Frontend Engineer",
      workplaceType: "onsite",
      employmentType: "Full-time",
      postedDate: new Date(Date.now() - 86_400_000),
      technologies: ["React"],
      description: null as string | null,
    };
    const ma = scoreJob({ ...common, country: "morocco" }, profile);
    const fr = scoreJob({ ...common, country: "france" }, profile);
    expect(fr.score).toBeLessThan(ma.score);
    expect(fr.reasons.some((r) => r.toLowerCase().includes("france"))).toBe(true);
  });

  it("internships are penalized into non-default employment", () => {
    const r = scoreJob(
      {
        title: "Software Engineer",
        country: "morocco",
        workplaceType: "hybrid",
        employmentType: "Internship",
        postedDate: new Date(),
        technologies: [],
        description: null as string | null,
      },
      profile
    );
    expect(r.reasons.some((r) => r.toLowerCase().includes("internship"))).toBe(true);
  });

  it("caps jobs whose title centres on another stack (Java/Angular with a JS profile)", () => {
    const common = {
      country: "morocco" as const,
      workplaceType: "hybrid",
      employmentType: "Full-time",
      postedDate: new Date(Date.now() - 86_400_000),
      description: null as string | null,
    };
    const jsJob = scoreJob(
      { ...common, title: "Full Stack Developer", technologies: ["React", "Node.js", "TypeScript"] },
      profile
    );
    const javaJobSameAd = scoreJob(
      { ...common, title: "Senior Full Stack Developer Java / Angular ou React", technologies: ["Java", "Angular", "React"] },
      profile
    );
    expect(javaJobSameAd.score).toBeLessThan(jsJob.score - 15);
    expect(javaJobSameAd.reasons.some((r) => r.toLowerCase().includes("java"))).toBe(true);
    expect(javaJobSameAd.score).toBeGreaterThan(0); // still listed, never hidden
  });

  it("weights are configurable and honored", () => {
    const job = {
      title: "Frontend Developer",
      country: "morocco",
      workplaceType: "onsite",
      employmentType: "Full-time",
      postedDate: new Date(Date.now() - 86_400_000),
      technologies: [] as string[],
      description: null as string | null,
    };
    expect(resolveWeights({ title: 40 }).title).toBe(40);
    expect(resolveWeights().employment).toBe(DEFAULT_WEIGHTS.employment);
    const r = scoreJob(job, profile, { remote: 0, location: 20 });
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("normalize", () => {
  it("dedupes by external id across searches and canonicalizes the URL", () => {
    const a = { ...base, descriptionText: "React TypeScript job." };
    const b = {
      ...base,
      link: "https://www.linkedin.com/jobs/view/123?refId=xyz",
      descriptionText: "Different tracking params.",
    };
    const items = normalizeApifyItems([a, b], "morocco");
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.linkedin.com/jobs/view/123");
  });

  it("falls back to URL when the id is missing", () => {
    const a = { ...base, id: undefined, link: "https://www.linkedin.com/jobs/view/999" };
    const b = { ...base, id: undefined, link: "https://www.linkedin.com/jobs/view/999?x=1" };
    expect(normalizeApifyItems([a, b], "morocco")).toHaveLength(1);
  });

  it("drops the unusable items and extracts technologies", () => {
    const items = normalizeApifyItems(
      [null, {}, { ...base, title: undefined }, base],
      "france"
    );
    expect(items).toHaveLength(1);
    expect(items[0].technologies).toEqual(
      expect.arrayContaining(["React", "TypeScript", "Node.js"])
    );
  });
});
