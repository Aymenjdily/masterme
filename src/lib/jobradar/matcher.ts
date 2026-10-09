import type { TargetCountry } from "@/lib/jobradar/normalize";

const COUNTRY_TITLES: Record<string, string> = {
  morocco: "Morocco",
  france: "France",
  saudi_arabia: "Saudi Arabia",
  uk: "United Kingdom",
};

/**
 * Deterministic match engine (no LLM, no API cost). Scores a job 0-100
 * against the user's profile. A score expresses relevance to the profile,
 * not the probability of getting hired. Every score comes with reasons.
 */

export type MatchProfile = {
  title: string;
  yearsExperience: number;
  skills: string[];
  employmentTypes: string[];
  titleKeywords: string[];
  targetCountries: TargetCountry[];
};

export type MatchInput = {
  title: string;
  country: string | null;
  workplaceType: string | null;
  employmentType: string | null;
  postedDate: Date | null;
  technologies: string[];
  description: string | null;
};

export type WeightOverrides = Partial<{
  title: number;
  skills: number;
  experience: number;
  location: number;
  remote: number;
  employment: number;
  recency: number;
}>;

export const DEFAULT_WEIGHTS: Required<WeightOverrides> = {
  title: 25,
  skills: 30,
  experience: 10,
  location: 15,
  remote: 10,
  employment: 5,
  recency: 5,
};

export type MatchResult = {
  score: number;
  reasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
};

const mx = (factor: number, weight: number) => factor * weight;

export function resolveWeights(overrides?: WeightOverrides): Required<WeightOverrides> {
  return { ...DEFAULT_WEIGHTS, ...(overrides ?? {}) };
}

// --- factors, each returns [0..1, reasonWhenNotable] -------------------------

/**
 * Core stacks that make a role fundamentally different from a JS/TS web
 * profile when they appear in the TITLE (titles state the primary stack).
 * Descriptions stay out of this — they mention too much.
 */
const TITLE_STACK_CONFLICTS: RegExp[] = [
  /\bjava\b/i,
  /\bangular\b/i,
  /\bpython\b/i,
  /\bdjango\b/i,
  /\bphp\b/i,
  /\blaravel\b/i,
  /\bwordpress\b/i,
  /\brails\b/i,
  /\bvue\b/i,
  /\bsvelte\b/i,
  /\b\.net\b/i,
  /\bc#\b/i,
  /\bc\+\+\b/i,
  /\bgolang\b/i,
  /\brust\b/i,
  /\bflutter\b/i,
  /\bandroid\b/i,
  /\bios\b/i,
  /\breact native\b/i,
  /\bmobile\b/i,
  /\bsap\b/i,
];

function titleStackConflict(title: string, profile: MatchProfile): string | null {
  const strip = (x: string) => x.toLowerCase().replace(/[^a-z0-9.#+]/g, "");
  const profileSkills = profile.skills.map(strip);
  for (const conflict of TITLE_STACK_CONFLICTS) {
    const tech = title.match(conflict)?.[0];
    if (!tech) continue;
    const key = strip(tech);
    // exact-ish token match: "JavaScript" must NOT satisfy a "Java" claim
    if (profileSkills.some((s) => s === key || s === key + "js" || key === s + "js")) continue;
    return tech;
  }
  return null;
}

function titleRelevance(
  title: string,
  profile: MatchProfile
): [number, string | null, string | null] {
  const t = title.toLowerCase();
  const conflict = titleStackConflict(title, profile);
  const isFullStack = t.includes("full stack") || t.includes("fullstack");

  // A title naming another primary stack (e.g. "Full Stack Java/Angular")
  // cannot be a top match for a JS/TS profile, whatever else is in the AD.
  if (conflict) {
    return [
      0.25,
      `Role centres on ${conflict} in the title — different stack from mine, capped score.`,
      conflict,
    ];
  }
  if (isFullStack && /(developer|engineer|dev)/.test(t)) {
    return [1, "Strong full-stack title match.", null];
  }
  for (const keyword of profile.titleKeywords) {
    if (keyword.trim().length > 2 && t.includes(keyword.toLowerCase())) {
      return [0.9, `Title matches "${keyword}".`, null];
    }
  }
  if (/(frontend|front-end|ui engineer|web developer)/.test(t)) {
    return [0.8, "Frontend/web development role.", null];
  }
  if (/(backend|back-end)/.test(t)) {
    return [0.7, "Backend role — adjacent to my profile.", null];
  }
  if (/software|developer|engineer|programmer/.test(t)) {
    return [0.6, "General software engineering role.", null];
  }
  return [0.2, "Title is not clearly related to my profile.", null];
}

function skillMatch(
  jobTechs: string[],
  profile: MatchProfile
): [number, string | null, string[], string[]] {
  const profileSkills = profile.skills.map((s) => s.toLowerCase());
  const matched = jobTechs.filter((tech) =>
    profileSkills.some((s) => s === tech.toLowerCase() || tech.toLowerCase().includes(s))
  );
  const missing = jobTechs.filter((tech) => !matched.includes(tech));

  if (profileSkills.length === 0) {
    return [0.5, null, matched, missing];
  }
  if (matched.length >= 3) {
    return [1, `Strong match with my skills (${matched.slice(0, 4).join(", ")}).`, matched, missing];
  }
  if (matched.length >= 1) {
    return [0.75, `Matches ${matched.join(", ")} of my skills.`, matched, missing];
  }
  if (jobTechs.length === 0) {
    return [0.5, null, [], []]; // no info — neutral, never auto-reject
  }
  return [0.25, "No overlap with my listed skills so far.", [], jobTechs];
}

/**
 * Looks for explicit "N+ years" requirements. Missing info stays neutral —
 * a job that does not state experience is never rejected for it.
 */
const YEARS_REGEX = /(\d{1,2})\+?\s*(?:to\s*(\d{1,2})\+?)?\s*(?:-\s*(\d{1,2}))?\s*(?:years|ans)\b/gi;

function experienceMatch(
  description: string | null,
  years: number
): [number, string | null] {
  if (!description) return [0.7, null];
  const matches = Array.from(description.matchAll(YEARS_REGEX));
  const required = matches
    .map((m) => Number(m[1]))
    .filter((n) => n >= 1 && n <= 15)
    .sort((a, b) => b - a);
  const maxRequired = required[0];
  if (maxRequired === undefined) return [0.7, null];
  if (maxRequired <= years + 1) {
    return [1, `Experience requirement (${maxRequired}+ yrs) is suitable.`];
  }
  if (maxRequired <= years + 3) {
    return [0.6, `Requires ${maxRequired}+ years — slightly more experience than I have.`];
  }
  return [0.1, `Requires ${maxRequired}+ years — well above my experience.`];
}

function locationMatch(
  country: string | null,
  workplaceType: string | null,
  profile: MatchProfile
): [number, string | null] {
  if (!country || !profile.targetCountries.includes(country as TargetCountry)) {
    return [0.4, null];
  }
  if (workplaceType === "remote" || workplaceType === "hybrid") {
    return [1, "Compatible location (works remotely/hybrid)."];
  }
  if (country === "morocco") {
    return [1, "On-site in Morocco — target location."];
  }
  // On-site abroad: relevant, but eligibility (visa/sponsorship) must be checked
  return [0.6, `On-site in ${COUNTRY_TITLES[country] ?? country} — check eligibility/sponsorship.`];
}

function remoteMatch(workplaceType: string | null): [number, string | null] {
  switch (workplaceType) {
    case "remote":
      return [1, "Remote position."];
    case "hybrid":
      return [0.8, "Hybrid position."];
    default:
      return [0.6, null]; // on-site/unknown — tolerable, not ideal
  }
}

function employmentMatch(
  employmentType: string | null,
  profile: MatchProfile
): [number, string | null] {
  if (!employmentType) return [0.6, null];
  const type = employmentType.toLowerCase();
  if (profile.employmentTypes.some((e) => type.includes(e))) {
    return [1, null];
  }
  if (/intern/.test(type)) {
    return [0.2, "Internship — below my experience level."];
  }
  return [0.5, `Employment type "${employmentType}" is not my preferred one.`];
}

function recencyMatch(postedDate: Date | null): [number, string | null] {
  if (!postedDate) return [0.5, null];
  const ageDays = (Date.now() - postedDate.getTime()) / 86_400_000;
  if (ageDays <= 3) return [1, "Posted in the last 3 days."];
  if (ageDays <= 7) return [0.8, null];
  if (ageDays <= 14) return [0.6, null];
  return [0.4, "Posting is more than two weeks old."];
}

/** Scores one job; deterministic for identical inputs. */
export function scoreJob(
  job: MatchInput,
  profile: MatchProfile,
  weightOverrides?: WeightOverrides
): MatchResult {
  const weights = resolveWeights(weightOverrides);

  const [titleFactor, titleReason, titleConflict] = titleRelevance(job.title, profile);
  const [skillFactor, skillReason, matchedSkills, missingSkills] = skillMatch(
    job.technologies,
    profile
  );
  const [experienceFactor, experienceReason] = experienceMatch(
    job.description,
    profile.yearsExperience
  );
  const [locationFactor, locationReason] = locationMatch(
    job.country,
    job.workplaceType,
    profile
  );
  const [remoteFactor, remoteReason] = remoteMatch(job.workplaceType);
  const [employmentFactor, employmentReason] = employmentMatch(
    job.employmentType,
    profile
  );
  const [recencyFactor, recencyReason] = recencyMatch(job.postedDate);

  const raw =
    mx(titleFactor, weights.title) +
    mx(skillFactor, weights.skills) +
    mx(experienceFactor, weights.experience) +
    mx(locationFactor, weights.location) +
    mx(remoteFactor, weights.remote) +
    mx(employmentFactor, weights.employment) +
    mx(recencyFactor, weights.recency);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const reasons: string[] = [];
  for (const reason of [
    titleReason,
    skillReason,
    experienceReason,
    locationReason,
    remoteReason,
    employmentReason,
    recencyReason,
  ]) {
    if (reason) reasons.push(reason);
  }

  // Hard gate: a clearly unrelated title caps the whole score — no amount of
  // neutral factors should make "Nurse Practitioner" look half-relevant.
  let scale = 1;
  if (titleFactor <= 0.2) {
    scale = 0.5;
    reasons.push("Title is unrelated to my profile — score reduced.");
  }
  // A title that names another primary stack (Java, Angular, Python…) stays
  // capped even when the description mentions a few of my technologies.
  if (titleConflict) scale = Math.min(scale, 0.75);

  const score = Math.round(((raw / totalWeight) * 100) * scale);

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    matchedSkills,
    missingSkills,
  };
}
