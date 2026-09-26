import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { choice, decide, noul } from "@/lib/ai/decisions";
import { generateObject } from "@/lib/ai/openai";
import { gate } from "@/lib/ai/confidence";
import { aiRateLimited } from "@/lib/ai/log";
import { PASTE_KINDS, type ClassifyResult, type ExtractResult, type PasteKind } from "@/lib/ai/paste-kinds";

// Paste anything: classify pasted text, then fill the matching form. Server-only.

export { PASTE_KINDS };

export const pasteTextSchema = z.string().trim().min(1, "Paste some text").max(4000, "Keep it under 4,000 characters");

const KIND_CRITERIA: Record<PasteKind | "other", string> = {
  recruiter: "a person (recruiter, HR, hiring manager) reaching out or sharing their contact details",
  application: "a job post or job description the user could apply to, with no personal outreach",
  learning: "a course, tutorial, video, book or doc the user wants to learn from",
  radar: "a tech news article, library, repo, release or trend to read about later",
  portfolio: "a link to the user's own work: their site, project demo, CV or profile",
  other: "none of the above: chat, reminders, unrelated text",
};

/** True when the user has made too many paste AI calls in the last 10 minutes (about 20 runs). */
export function pasteRateLimited(userId: string) {
  return aiRateLimited(userId, "paste.", 80);
}

export async function classifyPaste(userId: string, text: string): Promise<ClassifyResult> {
  const startedAt = performance.now();
  const { answers, confidence, eventId } = await decide({
    userId,
    feature: "paste.classify",
    state: `Text the user pasted into their personal career organizer:\n"""\n${text}\n"""`,
    questions: {
      kind: choice("Which module should this pasted text be saved to?", [...PASTE_KINDS, "other"], KIND_CRITERIA),
    },
  });
  const kind = answers.kind.choice;
  return {
    eventId,
    kind,
    probabilities: answers.kind.probabilities,
    confidence,
    // "other" is never acted on: the user picks a type.
    gate: kind === "other" ? "ask" : gate(confidence),
    ms: Math.round(performance.now() - startedAt),
  };
}

const nullableText = z.string().nullable();

export const extractionSchemas = {
  recruiter: z.object({
    name: nullableText.describe("The recruiter's full name."),
    company: nullableText,
    email: nullableText,
    phone: nullableText.describe("Phone number exactly as written."),
    linkedinUrl: nullableText,
    notes: nullableText.describe("Summary of what they want, one or two short sentences in English. null if unclear."),
    jobTitle: nullableText.describe("The role they are recruiting for, if one is named."),
  }),
  application: z.object({
    title: nullableText.describe("The job title."),
    company: nullableText,
    url: nullableText.describe("Link to the job post or application page."),
  }),
  learning: z.object({
    title: nullableText.describe("Short name of the topic or resource, taken from the text."),
    description: nullableText.describe("Summary of the resource in one sentence, based only on the text. null if the text says nothing about it."),
    resourceUrl: nullableText,
  }),
  radar: z.object({
    title: nullableText,
    url: nullableText,
    description: nullableText.describe("Summary in one sentence, based only on the text. null if the text says nothing about it."),
  }),
  portfolio: z.object({
    title: nullableText.describe("Short label for the link: the project or site name from the text."),
    url: nullableText,
  }),
} satisfies Record<PasteKind, z.ZodObject>;

const EXTRACT_SYSTEM =
  "Extract fields from text a user pasted into their personal career organizer. " +
  "Copy names, emails, phone numbers and links exactly as written. " +
  "Use null for anything that is not in the text. Never invent values, and never copy these instructions into a field. " +
  "The text may be in English, French or Arabic; write notes and descriptions in English.";

function state(text: string) {
  return `Pasted text:\n"""\n${text}\n"""`;
}

/** Extra decision that depends on the kind (which path, which stack, also an application?). */
async function routeDecision(userId: string, kind: PasteKind, text: string) {
  if (kind === "recruiter") {
    const { answers, eventId } = await decide({
      userId,
      feature: "paste.route",
      state: state(text),
      questions: { opening: noul("Does the text name a specific job opening the person is recruiting for?") },
    });
    return { eventId, alsoApplication: { value: answers.opening.noul, probability: answers.opening.probability } };
  }

  if (kind === "learning") {
    const paths = await prisma.learningPath.findMany({
      where: { userId, status: "active" },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    });
    if (paths.length <= 1) {
      return { eventId: null, paths: paths.map((p) => ({ ...p, probability: 1 })) };
    }
    // Options are the path ids; the titles go in as criteria so the model judges by name.
    const ids = paths.map((p) => p.id);
    const { answers, eventId } = await decide({
      userId,
      feature: "paste.route",
      state: state(text),
      questions: {
        path: choice(
          "Which of the user's learning paths does this resource belong to?",
          ids,
          Object.fromEntries(paths.map((p) => [p.id, p.title]))
        ),
      },
    });
    const probabilities = answers.path.probabilities as Record<string, number>;
    return {
      eventId,
      paths: paths
        .map((p) => ({ ...p, probability: probabilities[p.id] ?? 0 }))
        .sort((a, b) => b.probability - a.probability),
    };
  }

  if (kind === "radar") {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { skills: true } });
    const skills = user?.skills ?? [];
    if (skills.length === 0) return { eventId: null, stack: { skill: null, probability: 1 } };
    const { answers, eventId } = await decide({
      userId,
      feature: "paste.route",
      state: state(text),
      questions: { stack: choice("Which technology from the user's stack is this mainly about?", [...skills, "none"]) },
    });
    // Below 50% the AI doesn't guess a tag (see confidence.ts).
    const skill = answers.stack.choice === "none" || gate(answers.stack.confidence) === "ask" ? null : answers.stack.choice;
    return { eventId, stack: { skill, probability: answers.stack.confidence } };
  }

  return { eventId: null };
}

export async function extractPaste(userId: string, text: string, kind: PasteKind): Promise<ExtractResult> {
  const startedAt = performance.now();
  const [fill, route] = await Promise.all([
    generateObject({
      userId,
      feature: "paste.fill",
      name: `${kind}_fields`,
      schema: extractionSchemas[kind],
      system: EXTRACT_SYSTEM,
      prompt: text,
      summary: { kind },
    }),
    routeDecision(userId, kind, text),
  ]);

  const { eventId: routeEventId, ...extras } = route;
  return {
    eventId: fill.eventId,
    routeEventId,
    kind,
    fields: fill.data as Record<string, string | null>,
    ...extras,
    ms: Math.round(performance.now() - startedAt),
  };
}
