import { z } from "zod";

/**
 * Normalization + dedupe for Apify LinkedIn job results.
 * The actor output is validated with Zod — its shape can change, and
 * missing data must never crash a collection run.
 */

export type TargetCountry = "morocco" | "france" | "saudi_arabia" | "uk";

/** LinkedIn location text per target country. */
export const COUNTRY_LOCATIONS: Record<TargetCountry, string> = {
  morocco: "Morocco",
  france: "France",
  saudi_arabia: "Saudi Arabia",
  uk: "United Kingdom",
};

const cleanText = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** The actor has returned slightly different shapes over time; every field optional. */
export const apifyJobItemSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  title: z.string().optional().transform(cleanText),
  companyName: z.string().optional().transform(cleanText),
  company: z.string().optional().transform(cleanText),
  location: z.string().optional().transform(cleanText),
  link: z.string().optional().transform(cleanText),
  applyUrl: z.string().optional().transform(cleanText),
  postedAt: z.string().optional().transform(cleanText),
  postedDate: z.string().optional().transform(cleanText),
  employmentType: z.string().optional().transform(cleanText),
  descriptionText: z.string().optional().transform(cleanText),
  description: z.string().optional().transform(cleanText),
  salary: z.string().optional().transform(cleanText),
  salaryInfo: z.array(z.string()).optional(),
  workRemoteAllowed: z.boolean().optional(),
  workplaceTypes: z.array(z.string()).optional(),
  seniorityLevel: z.string().optional().transform(cleanText),
});

export type ApifyJobItem = z.infer<typeof apifyJobItemSchema>;

export type NormalizedJob = {
  externalId: string | null;
  url: string;
  title: string;
  company: string;
  location: string | null;
  country: TargetCountry;
  workplaceType: string;
  employmentType: string | null;
  description: string | null;
  salary: string | null;
  postedDate: Date | null;
  technologies: string[];
};

/** Tech keywords scanned for in the description. Kept small and boring on purpose. */
const TECH_KEYWORDS = [
  "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Express.js", "NestJS",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST", "Prisma", "Tailwind",
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Python", "Java", "PHP", "Laravel",
  "Django", "Rails", "Vue", "Angular", "Svelte", "Supabase", "Firebase", "Git",
];

function extractTechnologies(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const tech of TECH_KEYWORDS) {
    const escaped = tech.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped.toLowerCase()}\\b`).test(lower)) found.push(tech);
  }
  return found;
}

const WORKPLACE_MAP: Record<string, string> = {
  remote: "remote",
  hybrid: "hybrid",
  "on-site": "onsite",
  onsite: "onsite",
  "on site": "onsite",
};

function normalizeWorkplaceType(item: ApifyJobItem): string {
  const labels = (item.workplaceTypes ?? []).map((t) => t.toLowerCase().trim());
  const matched = labels
    .map((label) => WORKPLACE_MAP[label] ?? null)
    .filter((v): v is string => v !== null);
  if (matched.length > 0) return matched[0];
  if (item.workRemoteAllowed === true) return "remote"; // remote allowed but type unknown
  return "unknown";
}

/**
 * Canonical listing URL: LinkedIn job view links are stable once reduced to
 * https://www.linkedin.com/jobs/view/{id}; tracking params differ per search.
 */
function canonicalJobUrl(item: ApifyJobItem): string | null {
  if (item.id) return `https://www.linkedin.com/jobs/view/${item.id}`;
  if (!item.link) return null;
  const base = item.link.split("?")[0].trim();
  return base.length > 0 ? base : null;
}

function parsePostedDate(raw: string | null): Date | null {
  if (!raw) return null;
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;
  // Relative fallback ("2 weeks ago")
  const match = raw.match(/(\d+)\s+(day|week|month|hour|minute)s?\s+ago/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const msPerUnit: Record<string, number> = {
    minute: 60_000, hour: 3_600_000, day: 86_400_000,
    week: 604_800_000, month: 2_592_000_000,
  };
  return new Date(Date.now() - amount * (msPerUnit[unit] ?? 0));
}

/** Maps one raw Apify item to the internal format; returns null if unusable. */
export function normalizeApifyItem(
  raw: unknown,
  country: TargetCountry
): NormalizedJob | null {
  const parsed = apifyJobItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;

  const title = item.title ?? item.company ?? null;
  const company = item.companyName ?? item.company ?? null;
  const url = canonicalJobUrl(item);
  if (!title || !company || !url) return null;

  const description = item.descriptionText ?? item.description ?? null;
  const salary =
    item.salary ?? item.salaryInfo?.find((s) => s && s.trim().length > 0) ?? null;

  return {
    externalId: item.id ?? null,
    url,
    title,
    company,
    location: item.location ?? null,
    country,
    workplaceType: normalizeWorkplaceType(item),
    employmentType: item.employmentType ?? null,
    description: description ? description.slice(0, 20_000) : null,
    salary,
    postedDate: parsePostedDate(item.postedAt ?? item.postedDate),
    technologies: description ? extractTechnologies(description) : [],
  };
}

export function normalizeApifyItems(
  raw: unknown[],
  country: TargetCountry
): NormalizedJob[] {
  const byKey = new Map<string, NormalizedJob>();
  for (const item of raw) {
    const job = normalizeApifyItem(item, country);
    if (!job) continue;
    // External id is the primary dedupe key; URL is the fallback
    const key = job.externalId ? `id:${job.externalId}` : `url:${job.url}`;
    if (!byKey.has(key)) byKey.set(key, job);
  }
  return Array.from(byKey.values());
}
