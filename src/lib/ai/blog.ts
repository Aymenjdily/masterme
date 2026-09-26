import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { choice, decide, score, type Question } from "@/lib/ai/decisions";
import { generateObject } from "@/lib/ai/openai";
import { aiRateLimited } from "@/lib/ai/log";
import { allTitles, voiceSamples } from "@/lib/sanity";
import { slugify } from "@/lib/portable-text";
import {
  LENGTH_WORDS,
  type BlogLanguage,
  type BlogLength,
  type BlogSourceKind,
  type SuggestResult,
  type WriteResult,
} from "@/lib/ai/blog-kinds";

// AI blog writer: topic ideas from real work, "already covered?" check, draft in the author's voice.
// Server-only. The model may only use facts from the chosen item and the user's notes.

const MAX_CANDIDATES = 10;
const COVERED_THRESHOLD = 0.6;

export function blogRateLimited(userId: string) {
  return aiRateLimited(userId, "blog.", 20);
}

type Source = { key: string; kind: BlogSourceKind; name: string; facts: string };

async function sources(userId: string): Promise<Source[]> {
  const [projects, paths, radar] = await Promise.all([
    prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.learningPath.findMany({
      where: { userId, status: { in: ["active", "completed"] } },
      include: { items: { orderBy: { order: "asc" }, select: { title: true, status: true } } },
      take: 4,
    }),
    prisma.techNews.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  return [
    ...projects.map((p) => ({
      key: `project:${p.id}`,
      kind: "project" as const,
      name: p.title,
      facts: [
        `The author BUILT this project: "${p.title}" (${p.type === "saas" ? "SaaS" : p.type}, ${p.status})`,
        p.clientName ? `client: ${p.clientName}` : null,
        p.description ? `description: ${p.description}` : null,
        p.url ? `url: ${p.url}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    })),
    ...paths.map((p) => ({
      key: `learning:${p.id}`,
      kind: "learning" as const,
      name: p.title,
      facts: `The author is LEARNING this (their learning path): "${p.title}" (${p.status})${p.description ? `: ${p.description}` : ""}. Steps: ${
        p.items.map((i) => `${i.title} (${i.status.replace("_", " ")})`).join(", ") || "none yet"
      }`,
    })),
    ...radar.map((n) => ({
      key: `radar:${n.id}`,
      kind: "radar" as const,
      name: n.title,
      facts: `Someone else's open-source GitHub repo the author only FOUND (they did not build it): "${n.title}"${n.description ? `: ${n.description}` : ""}${n.tags.length ? ` (${n.tags.join(", ")})` : ""}`,
    })),
  ].slice(0, MAX_CANDIDATES);
}

async function sourceByKey(userId: string, key: string | undefined) {
  if (!key) return null;
  return (await sources(userId)).find((s) => s.key === key) ?? null;
}

export async function suggestTopics(userId: string): Promise<SuggestResult> {
  const [items, titles] = await Promise.all([sources(userId), allTitles()]);
  if (items.length === 0) {
    return { topics: [], language: { choice: "en", probabilities: { en: 1, fr: 0 } }, eventIds: [] };
  }

  const questions: Record<string, Question> = {
    language: choice("Which language is this developer's blog written in?", ["en", "fr"], {
      en: "most existing titles are in English",
      fr: "most existing titles are in French",
    }),
  };
  items.forEach((item, i) => {
    questions[`c${i}`] = score(`How good a blog post topic is this for this blog: ${item.facts}?`, 5, {
      1: "boring or off-topic",
      3: "fine",
      5: "a post readers and recruiters would click",
    });
  });

  const decision = await decide({
    userId,
    feature: "blog.suggest",
    state: [
      "A full-stack developer's personal blog. Existing post titles:",
      ...titles.slice(0, 30).map((t) => `- ${t}`),
      "Good topics are practical, first-person, about real things the author built or learned, and not already covered.",
    ].join("\n"),
    questions,
    summary: { candidates: items.length },
  });
  const answers = decision.answers as Record<string, { probabilities: number[] | Record<string, number>; choice?: string }>;

  const ranked = items
    .map((item, i) => {
      const p = answers[`c${i}`].probabilities as number[];
      return { item, fit: (p[3] ?? 0) + (p[4] ?? 0) };
    })
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 3);

  const naming = await generateObject({
    userId,
    feature: "blog.suggest",
    name: "blog_topics",
    schema: z.object({ titles: z.array(z.object({ id: z.string(), title: z.string() })) }),
    system:
      "You turn a developer's real work into blog post title ideas. Match the style of their existing titles " +
      '(practical, first person). Use only the given facts; no invented numbers or results. Max 80 characters. ' +
      'Respect ownership: "How I built…" only for things the author BUILT. For things they are LEARNING use angles like ' +
      '"What I learned…". For repos they only FOUND use angles like "What I took from…" or "A closer look at…", never claim they built it. Give each title a different structure and angle.',
    prompt: [
      `Existing titles:\n${titles.slice(0, 10).map((t) => `- ${t}`).join("\n")}`,
      `Items:\n${ranked.map((r, i) => `id=${i}: ${r.item.facts}`).join("\n")}`,
    ].join("\n\n"),
  });
  const named = new Map(naming.data.titles.map((t) => [t.id, t.title]));

  const lang = answers.language as unknown as { choice: BlogLanguage; probabilities: Record<BlogLanguage, number> };
  return {
    topics: ranked.map((r, i) => ({
      sourceKey: r.item.key,
      source: { kind: r.item.kind, name: r.item.name },
      title: named.get(String(i)) || r.item.name,
      fit: r.fit,
    })),
    language: { choice: lang.choice, probabilities: lang.probabilities },
    eventIds: [decision.eventId, naming.eventId].filter((id): id is string => !!id),
  };
}

export const writeRequestSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(2000).optional(),
  sourceKey: z.string().max(80).optional(),
  language: z.enum(["en", "fr"]),
  length: z.enum(["short", "medium", "long"]),
  /** Write even when a similar post exists */
  force: z.boolean().optional(),
});

const draftSchema = z.object({
  title: z.string().describe("Post title, max 90 characters"),
  excerpt: z.string().describe("One or two sentences, max 220 characters, for the post preview"),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("Section heading"),
        markdown: z
          .string()
          .describe("Section body: paragraphs, optional ### subheadings, - bullet lists, **bold**, fenced code blocks with a language"),
      })
    )
    .describe("The post body, 3 to 7 sections"),
});

function writingSystem(language: BlogLanguage) {
  return [
    `You write blog posts for a full-stack developer, in ${language === "fr" ? "French" : "English"}, in their voice: first person, practical, direct, no hype, no emojis.`,
    "Use ONLY the facts provided (the item and the author's notes). Never invent numbers, clients, results, dates, quotes or features.",
    "Respect ownership: never claim the author built something the facts say they only found or are learning.",
    "When a detail is missing, stay general instead of making it up. Code examples must be small and generic, clearly illustrative.",
    "Markdown in sections is limited to: paragraphs, ### subheadings, - bullet lists, **bold**, and fenced code blocks with a language.",
  ].join(" ");
}

export async function writePost(userId: string, req: z.infer<typeof writeRequestSchema>): Promise<WriteResult> {
  const startedAt = performance.now();
  const [source, titles, voice] = await Promise.all([sourceByKey(userId, req.sourceKey), allTitles(), voiceSamples()]);

  if (!req.force && titles.length > 0) {
    const check = await decide({
      userId,
      feature: "blog.covered",
      state: `New post idea: "${req.topic}"${req.notes ? `\nNotes: ${req.notes.slice(0, 400)}` : ""}`,
      questions: {
        same: choice(
          "Which existing post already covers the same topic from the same angle? Pick none if it's a different angle.",
          [...titles.slice(0, 60), "none"]
        ),
      },
      summary: { titles: titles.length },
    });
    const same = check.answers.same;
    if (same.choice !== "none" && same.confidence >= COVERED_THRESHOLD) {
      return { covered: { title: same.choice, probability: same.confidence }, eventId: check.eventId };
    }
  }

  const words = LENGTH_WORDS[req.length as BlogLength];
  const facts = [source ? source.facts : null, req.notes ? `Author's notes: ${req.notes}` : null].filter(Boolean);
  const draft = await generateObject({
    userId,
    feature: "blog.write",
    name: "blog_post",
    schema: draftSchema,
    system: writingSystem(req.language),
    prompt: [
      `Topic: ${req.topic}`,
      facts.length ? `Facts:\n${facts.join("\n")}` : "Facts: none beyond the topic; keep it general and practical.",
      `Length: about ${words} words.`,
      voice.length
        ? `Match the voice of these recent posts:\n${voice.map((v) => `- ${v.title}${v.excerpt ? `: ${v.excerpt}` : ""}`).join("\n")}`
        : "",
    ].join("\n\n"),
    summary: { length: req.length, language: req.language, source: source?.kind ?? "own" },
  });

  return {
    draft: {
      title: draft.data.title.trim(),
      slug: slugify(draft.data.title),
      excerpt: draft.data.excerpt.trim(),
      sections: draft.data.sections.map((s) => ({ heading: s.heading.trim(), markdown: s.markdown.trim() })),
    },
    factsUsed: [
      ...(req.notes ? ["your notes"] : []),
      ...(source ? [`${source.kind} "${source.name}"`] : []),
      ...(voice.length ? [`voice from your last ${voice.length} posts`] : []),
    ],
    eventIds: [draft.eventId].filter((id): id is string => !!id),
    ms: Math.round(performance.now() - startedAt),
  };
}

export const rewriteRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional(),
  sourceKey: z.string().max(80).optional(),
  language: z.enum(["en", "fr"]),
  heading: z.string().max(200),
  markdown: z.string().max(12000),
});

export async function rewriteSection(userId: string, req: z.infer<typeof rewriteRequestSchema>) {
  const source = await sourceByKey(userId, req.sourceKey);
  const result = await generateObject({
    userId,
    feature: "blog.rewrite",
    name: "blog_section",
    schema: z.object({ heading: z.string(), markdown: z.string() }),
    system: writingSystem(req.language),
    prompt: [
      `Post: ${req.title}`,
      source ? `Facts: ${source.facts}` : "",
      req.notes ? `Author's notes: ${req.notes}` : "",
      `Rewrite this section with clearer, different wording. Same facts, similar length:\n## ${req.heading}\n${req.markdown}`,
    ].join("\n\n"),
  });
  return { section: { heading: result.data.heading.trim(), markdown: result.data.markdown.trim() }, eventId: result.eventId };
}
