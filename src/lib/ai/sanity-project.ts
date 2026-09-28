import { z } from "zod";
import { choice, decide } from "@/lib/ai/decisions";
import { generateObject } from "@/lib/ai/openai";
import { aiRateLimited } from "@/lib/ai/log";
import { readSite, type SiteRead } from "@/lib/site-reader";
import { readRepo, type RepoRead } from "@/lib/github-repo";
import { findProjectDuplicate, listProjects, projectStyleSamples, projectTechnologies, techKey, uniqueSlug } from "@/lib/sanity";
import { slugify } from "@/lib/portable-text";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type GenerateProjectResult,
  type ProjectKind,
  type ProjectStatus,
  type TechTag,
} from "@/lib/ai/sanity-project-kinds";

// "Add a portfolio project from a link": read the site (+ GitHub repo), then fill every field of the
// Sanity `project` document. Server-only. Facts come only from the sources and the user's notes.

export const generateRequestSchema = z
  .object({
    url: z.string().trim().url().max(500).optional(),
    repoUrl: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.url || v.repoUrl, { message: "Add the live site or the GitHub repo." });

export function projectRateLimited(userId: string) {
  return aiRateLimited(userId, "sanityproject.", 20);
}

/** package.json dependency → technology names to try, in order, against the portfolio's existing spellings. */
const DEPENDENCY_TECH: [RegExp, string[]][] = [
  [/^next$/, ["Next.js", "Next js"]],
  [/^typescript$/, ["TypeScript"]],
  [/^(tailwindcss|@tailwindcss\/.+)$/, ["TailwindCSS", "Tailwind Css"]],
  [/^(prisma|@prisma\/client)$/, ["Prisma"]],
  [/^(pg|postgres|@prisma\/adapter-pg)$/, ["PostgreSQL"]],
  [/^@neondatabase\/serverless$/, ["Neon DB"]],
  [/^(mongoose|mongodb)$/, ["Mongo DB"]],
  [/^(redis|ioredis|@upstash\/redis)$/, ["Redis"]],
  [/^(stripe|@stripe\/stripe-js)$/, ["Stripe"]],
  [/^(next-auth|@auth\/core)$/, ["Next Auth"]],
  [/^better-auth$/, ["Better Auth"]],
  [/^(sanity|next-sanity|@sanity\/client)$/, ["Sanity CMS", "Sanity Cms"]],
  [/^(framer-motion|motion)$/, ["Framer Motion"]],
  [/^@nestjs\/core$/, ["NestJS"]],
  [/^@trigger\.dev\/sdk$/, ["Trigger dev"]],
  [/^openai$/, ["OpenAI"]],
  [/^(@google\/generative-ai|@google\/genai)$/, ["Gemini Api"]],
  [/^shadcn$/, ["Shadcn UI"]],
  [/^@tanstack\/react-query$/, ["React Query"]],
];

/** Maps names to the spelling already used in the portfolio; unknown names are marked new. */
function normalizeTech(names: string[][], vocab: Map<string, string>): TechTag[] {
  const out = new Map<string, TechTag>();
  for (const options of names) {
    const known = options.map((o) => vocab.get(techKey(o))).find(Boolean);
    const tag = known ? { name: known, isNew: false } : { name: options[0], isNew: true };
    const key = techKey(tag.name);
    const sameAs = [...out.keys()].some((k) => k === key || (key.length >= 4 && (k.startsWith(key) || key.startsWith(k))));
    if (!sameAs) out.set(key, tag);
  }
  return [...out.values()];
}

function stackFromRepo(repo: RepoRead | null, previewUrl: string | null): string[][] {
  const names: string[][] = [];
  for (const dep of repo?.dependencies ?? []) {
    const hit = DEPENDENCY_TECH.find(([re]) => re.test(dep));
    if (hit) names.push(hit[1]);
  }
  if (previewUrl && /\.vercel\.app$/i.test(new URL(previewUrl).hostname)) names.push(["Vercel"]);
  return names;
}

const TYPE_CRITERIA: Record<ProjectKind, string> = {
  "client-work": "built for a client, company or organization other than the author (their brand, their site)",
  product: "a product or SaaS the author runs for users: sign-up, pricing, dashboard or an app people use",
  project: "a personal, side, learning or open-source project by the author",
};

const STATUS_CRITERIA: Record<ProjectStatus, string> = {
  live: "publicly available and working",
  beta: "marked beta, early access, work in progress, or not fully launched",
};

const writeSchema = z.object({
  title: z.string().describe("The project's name only (e.g. \"MasterMe\"), without taglines or site-title suffixes"),
  description: z.string().describe("One sentence, 80–160 characters, what it is and for whom"),
  overview: z.string().describe("2–3 short paragraphs separated by a blank line, 250–500 characters"),
  problem: z.string().describe("The problem it addresses, 1–2 paragraphs, 250–450 characters"),
  solution: z.string().describe("How the project solves it, 1–2 paragraphs, 250–500 characters"),
  businessImpact: z.array(z.string()).describe("3 to 6 short points, one sentence each"),
  body: z.array(z.string()).describe("3 to 4 paragraphs describing the project for the portfolio page"),
  extraTechnologies: z
    .array(z.string())
    .describe(
      "At most 3 major technologies (framework, database, platform or AI service) clearly named in the page or README and not already in the known stack. No small libraries or icon packs. Empty if unsure."
    ),
});

function sourceFacts(site: SiteRead | null, repo: RepoRead | null, notes: string | undefined) {
  return [
    site
      ? `LIVE SITE ${site.finalUrl}\nTitle: ${site.title ?? "-"}\nDescription: ${site.description ?? "-"}\n${
          site.loginOnly ? "(The page is mostly a login screen; little content.)" : `Page text: ${site.text.slice(0, 6000)}`
        }`
      : null,
    repo
      ? `GITHUB REPO ${repo.fullName}\nDescription: ${repo.description ?? "-"}\nTopics: ${repo.topics.join(", ") || "-"}\nMain language: ${
          repo.language ?? "-"
        }\nREADME:\n${repo.readme?.slice(0, 5000) ?? "(none)"}`
      : null,
    notes ? `AUTHOR'S NOTES: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateProject(userId: string, req: z.infer<typeof generateRequestSchema>): Promise<GenerateProjectResult> {
  const startedAt = performance.now();

  const [siteResult, repoResult, vocab, samples, list] = await Promise.all([
    req.url ? readSite(req.url).then((v) => ({ ok: v }), (e: Error) => ({ error: e.message })) : null,
    req.repoUrl ? readRepo(req.repoUrl).then((v) => ({ ok: v }), (e: Error) => ({ error: e.message })) : null,
    projectTechnologies(),
    projectStyleSamples(),
    listProjects(1),
  ]);
  const site = siteResult && "ok" in siteResult ? siteResult.ok : null;
  const repo = repoResult && "ok" in repoResult ? repoResult.ok : null;
  const preview = site?.finalUrl ?? req.url ?? (repo?.homepage || null);
  const source = repo?.htmlUrl ?? null;

  const usable = (site && !site.loginOnly) || repo || req.notes;
  if (!usable && !site?.title) {
    throw new Error(
      siteResult && "error" in siteResult
        ? `${siteResult.error} Add a GitHub repo or a few notes and I'll write from those.`
        : "Nothing to read. Add the live site, the GitHub repo or a few notes."
    );
  }

  const facts = sourceFacts(site, repo, req.notes);
  const repoStack = stackFromRepo(repo, preview);

  const [decision, writing, duplicate] = await Promise.all([
    decide({
      userId,
      feature: "sanityproject.decide",
      state: facts.slice(0, 7000),
      questions: {
        type: choice("What kind of portfolio project is this?", PROJECT_TYPES, TYPE_CRITERIA),
        status: choice("What is its status?", PROJECT_STATUSES, STATUS_CRITERIA),
      },
      summary: { site: !!site, repo: !!repo, notes: !!req.notes },
    }),
    generateObject({
      userId,
      feature: "sanityproject.write",
      name: "portfolio_project",
      schema: writeSchema,
      system: [
        "You write portfolio case studies for a full-stack developer's website, in English, first person where natural, clear and concrete, no hype, no emojis.",
        "Use ONLY the facts in the sources and the author's notes. Never invent clients, numbers, results, dates, users or features.",
        "When a detail is missing, stay general rather than making it up. Plain text only: no markdown, no bullet characters.",
        "Write about the project itself. Never mention the sources, the README, the live site's login screen, missing information or these instructions.",
      ].join(" "),
      prompt: [
        facts,
        repoStack.length ? `Known stack: ${repoStack.map((n) => n[0]).join(", ")}` : "",
        samples.length
          ? `Match the tone of these existing portfolio projects:\n${samples
              .map((s) => `- ${s.title}: ${s.description}\n  Problem: ${s.problem ?? ""}\n  Solution: ${s.solution ?? ""}`)
              .join("\n")}`
          : "",
      ].join("\n\n"),
      summary: { site: !!site, repo: !!repo },
    }),
    findProjectDuplicate(preview, source),
  ]);

  const w = writing.data;
  // GitHub renders a social card for every public repo: a decent cover when the site has none.
  const covers = [...(site?.images ?? []), ...(repo ? [`https://opengraph.githubassets.com/1/${repo.fullName}`] : [])];
  // Page titles often carry a tagline ("Name - Tagline", "Name | Tagline"): keep the name.
  const title = (w.title.trim() || site?.title || repo?.fullName.split("/")[1] || "New project").split(/\s+[-|–—:]\s+/)[0].trim();
  const extra = w.extraTechnologies.slice(0, 3).map((t) => [t.trim()]).filter((t) => t[0]);
  const technologies = normalizeTech([...repoStack, ...extra], vocab);
  const answers = decision.answers;

  return {
    found: {
      site: siteResult
        ? "ok" in siteResult
          ? { title: siteResult.ok.title, words: siteResult.ok.words, loginOnly: siteResult.ok.loginOnly, imageCount: siteResult.ok.images.length }
          : { error: siteResult.error }
        : null,
      repo: repoResult
        ? "ok" in repoResult
          ? { fullName: repoResult.ok.fullName, readme: !!repoResult.ok.readme, dependencies: repoResult.ok.dependencies.length }
          : { error: repoResult.error }
        : null,
      stack: normalizeTech(repoStack, vocab).map((t) => t.name),
      duplicate: duplicate ? { title: duplicate.title, studioUrl: duplicate.studioUrl } : null,
      projectCount: list.count,
    },
    draft: {
      title,
      slug: await uniqueSlug(slugify(title) || "project", "project"),
      description: w.description.trim(),
      overview: w.overview.trim(),
      problem: w.problem.trim(),
      solution: w.solution.trim(),
      businessImpact: w.businessImpact.map((p) => p.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).join("\n"),
      body: w.body.map((p) => p.trim()).filter(Boolean).join("\n\n"),
      type: answers.type.choice,
      status: answers.status.choice,
      year: repo?.createdYear ?? String(new Date().getFullYear()),
      featured: false,
      technologies,
      preview,
      source,
      publishedAt: new Date().toISOString(),
      images: covers,
      image: covers[0] ?? null,
    },
    probabilities: { type: answers.type.probabilities, status: answers.status.probabilities },
    eventIds: [decision.eventId, writing.eventId].filter((id): id is string => !!id),
    aiCalls: 3,
    ms: Math.round(performance.now() - startedAt),
  };
}
