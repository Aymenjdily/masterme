import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { choice, decide, type Question } from "@/lib/ai/decisions";
import { generateObject } from "@/lib/ai/openai";
import { aiRateLimited } from "@/lib/ai/log";
import {
  ACTION_LABEL,
  FOLLOW_UP_ACTIONS,
  FOLLOW_UP_LANGUAGES,
  FOLLOW_UP_TONES,
  LINKEDIN_MAX_CHARS,
  type FollowUpAction,
  type FollowUpChannel,
  type FollowUpLanguage,
  type FollowUpResult,
  type FollowUpTarget,
  type FollowUpTone,
} from "@/lib/ai/follow-up-kinds";

// Smart follow-up writer: decide what to say, language and tone, then draft. Server-only.

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_DAYS = 3;

export const followUpRequestSchema = z.object({
  target: z.enum(["application", "recruiter"]),
  id: z.string().min(1),
  channel: z.enum(["email", "linkedin"]),
  action: z.enum(FOLLOW_UP_ACTIONS).optional(),
  language: z.enum(FOLLOW_UP_LANGUAGES).optional(),
  tone: z.enum(FOLLOW_UP_TONES).optional(),
  /** Write even when the AI says wait */
  force: z.boolean().optional(),
  /** Rewrite this draft shorter */
  shorter: z.boolean().optional(),
  /** The current draft, for Shorter / Rewrite */
  previous: z.string().max(3000).optional(),
});
export type FollowUpRequest = z.infer<typeof followUpRequestSchema>;

export function followUpRateLimited(userId: string) {
  return aiRateLimited(userId, "followup.", 40);
}

type Context = {
  facts: string;
  /** When the user last reached out (or applied) */
  lastTouch: Date;
  touchVerb: string;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Calendar days between that date and today (yesterday = 1, even if under 24 hours ago). */
function days(from: Date) {
  return Math.round((startOfDay(new Date()) - startOfDay(from)) / DAY_MS);
}

function ago(from: Date) {
  const d = days(from);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

/** Loads the record for this user only and turns it into plain facts for the models. */
async function loadContext(userId: string, target: FollowUpTarget, id: string): Promise<Context | null> {
  if (target === "application") {
    const app = await prisma.jobApplication.findFirst({ where: { id, userId }, include: { jobOffer: true } });
    if (!app) return null;
    const lastTouch = app.lastFollowUpAt ?? app.applicationDate;
    const followedUp = app.lastFollowUpAt && app.lastFollowUpAt.getTime() - app.applicationDate.getTime() > 60_000;
    return {
      lastTouch,
      touchVerb: followedUp ? "followed up" : "applied",
      facts: [
        `Type: a job application the user sent (the message goes to the hiring team)`,
        `Job title: ${app.jobOffer.title}`,
        `Company: ${app.jobOffer.company}`,
        app.jobOffer.location ? `Location: ${app.jobOffer.location}` : null,
        `Status: ${app.status ?? "applied"}`,
        `Applied: ${ago(app.applicationDate)}`,
        `Last follow-up: ${followedUp ? ago(app.lastFollowUpAt!) : "none yet"}`,
        app.followUpNotes ? `User's notes: ${app.followUpNotes}` : `User's notes: none`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const contact = await prisma.recruiterContact.findFirst({ where: { id, userId } });
  if (!contact) return null;
  const lastTouch = contact.lastContactedAt ?? contact.createdAt;
  return {
    lastTouch,
    touchVerb: contact.lastContactedAt ? "last contacted them" : "added them",
    facts: [
      `Type: a recruiter the user is in touch with (the message goes to this person)`,
      `Recruiter name: ${contact.name}`,
      contact.company ? `Company: ${contact.company}` : null,
      `Last contact: ${contact.lastContactedAt ? ago(contact.lastContactedAt) : "never"}`,
      contact.notes ? `User's notes: ${contact.notes}` : `User's notes: none`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

const ACTION_CRITERIA: Record<FollowUpAction, string> = {
  next_steps: "an interview happened or a decision is pending: ask what the next steps are",
  thank_interview: "the notes say an interview happened in the last day or two and no thank-you was sent yet",
  share_update: "no reply for a long time (10+ days): re-engage by sharing availability or recent work",
  check_in: "applied or talked, no news yet: a short, polite check-in",
  wait: "the last contact was under 3 days ago, or the notes say they will answer by a date not reached yet",
};

/** The wait message comes from the dates, not the model, so it's always correct. */
function waitCopy(ctx: Context) {
  // Same rule as lib/follow-up.ts: due 3 days after the last touch.
  const next = new Date(ctx.lastTouch.getTime() + FOLLOW_UP_DAYS * DAY_MS);
  const nextLabel = next.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const left = next.getTime() > Date.now() ? Math.round((startOfDay(next) - startOfDay(new Date())) / DAY_MS) : 0;
  if (left > 0) {
    return {
      title: `Wait ${left} more day${left === 1 ? "" : "s"}`,
      text: `You ${ctx.touchVerb} ${ago(ctx.lastTouch)}. Following up this soon can feel pushy; the reminder comes back on ${nextLabel}.`,
    };
  }
  return {
    title: "Better to wait",
    text: "From your notes, it looks like they'll get back to you. You can still write if you want to.",
  };
}

const draftSchema = z.object({
  subject: z.string().nullable().describe("Email subject line. null for a LinkedIn message."),
  body: z.string().describe("The message body, ready to send, signed with the user's name."),
});

function draftPrompt(ctx: Context, req: FollowUpRequest, decided: { action: FollowUpAction; language: FollowUpLanguage; tone: FollowUpTone }, userName: string) {
  const lines = [
    `FACTS:\n${ctx.facts}`,
    `GOAL: ${ACTION_LABEL[decided.action === "wait" ? "check_in" : decided.action]}.`,
    `LANGUAGE: ${decided.language === "fr" ? "French" : "English"}. TONE: ${decided.tone}.`,
    req.channel === "email"
      ? "CHANNEL: email. Write a short subject and a body of 60 to 130 words, with a greeting and a sign-off."
      : `CHANNEL: LinkedIn message. No subject (null). At most ${LINKEDIN_MAX_CHARS} characters in total, including the sign-off.`,
    `SIGN AS: ${userName}`,
  ];
  if (req.previous) {
    lines.push(
      req.shorter
        ? `Rewrite this draft about half as long, same meaning:\n"""\n${req.previous}\n"""`
        : `Write a new version with different wording than this one:\n"""\n${req.previous}\n"""`
    );
  }
  return lines.join("\n\n");
}

const DRAFT_SYSTEM =
  "You write short job-search follow-up messages for the user. " +
  "Use only the facts given. Never invent names, numbers, salaries, dates, projects or anything not in the facts. " +
  "Don't claim a call, meeting or interview happened unless the facts say so. " +
  "If a recipient name is not given, use a neutral greeting. Sound like a real person: warm, direct, no clichés, no emojis.";

export async function writeFollowUp(userId: string, userName: string, req: FollowUpRequest): Promise<FollowUpResult | null> {
  const startedAt = performance.now();
  const ctx = await loadContext(userId, req.target, req.id);
  if (!ctx) return null;

  // Only ask the AI about what the user hasn't chosen yet.
  const questions: Record<string, Question> = {};
  if (!req.action) questions.action = choice("What should the user's next message do?", FOLLOW_UP_ACTIONS, ACTION_CRITERIA);
  if (!req.language)
    questions.language = choice("Which language should the message be in?", FOLLOW_UP_LANGUAGES, {
      en: "English: international company, English notes, or remote role",
      fr: "French: Moroccan or French company or location, or notes in French",
    });
  if (!req.tone)
    questions.tone = choice("Which tone fits best?", FOLLOW_UP_TONES, {
      friendly: "already talking with a person, or a startup",
      formal: "large company, HR department, or first contact",
    });

  let decisionEventId: string | null = null;
  const probabilities: FollowUpResult["probabilities"] = {};
  let aiCalls = 0;
  const decided = { action: req.action, language: req.language, tone: req.tone };

  if (Object.keys(questions).length > 0) {
    const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const result = await decide({
      userId,
      feature: "followup.decide",
      state: `Today: ${today}\n${ctx.facts}`,
      questions,
      summary: { target: req.target },
    });
    aiCalls++;
    decisionEventId = result.eventId;
    const answers = result.answers as Record<string, { choice: string; probabilities: Record<string, number> }>;
    if (answers.action) {
      decided.action = answers.action.choice as FollowUpAction;
      probabilities.action = answers.action.probabilities as Record<FollowUpAction, number>;
    }
    if (answers.language) {
      decided.language = answers.language.choice as FollowUpLanguage;
      probabilities.language = answers.language.probabilities as Record<FollowUpLanguage, number>;
    }
    if (answers.tone) {
      decided.tone = answers.tone.choice as FollowUpTone;
      probabilities.tone = answers.tone.probabilities as Record<FollowUpTone, number>;
    }
  }

  const final = decided as { action: FollowUpAction; language: FollowUpLanguage; tone: FollowUpTone };
  const base = {
    decisionEventId,
    action: final.action,
    language: final.language,
    tone: final.tone,
    channel: req.channel as FollowUpChannel,
    probabilities,
  };

  if (final.action === "wait" && !req.force) {
    return {
      ...base,
      draftEventId: null,
      wait: { ...waitCopy(ctx), probability: probabilities.action?.wait ?? 1 },
      aiCalls,
      ms: Math.round(performance.now() - startedAt),
    };
  }

  const prompt = draftPrompt(ctx, req, final, userName);
  let draft = await generateObject({
    userId,
    feature: "followup.draft",
    name: "follow_up",
    schema: draftSchema,
    system: DRAFT_SYSTEM,
    prompt,
    summary: { target: req.target, channel: req.channel, action: final.action },
  });
  aiCalls++;

  // LinkedIn has a hard limit: one retry asking for a shorter version.
  if (req.channel === "linkedin" && draft.data.body.length > LINKEDIN_MAX_CHARS) {
    draft = await generateObject({
      userId,
      feature: "followup.draft",
      name: "follow_up",
      schema: draftSchema,
      system: DRAFT_SYSTEM,
      prompt: `${prompt}\n\nYour last version was ${draft.data.body.length} characters. Keep it under ${LINKEDIN_MAX_CHARS - 20}.`,
      summary: { target: req.target, channel: req.channel, action: final.action, retry: true },
    });
    aiCalls++;
  }

  return {
    ...base,
    draftEventId: draft.eventId,
    draft: {
      subject: req.channel === "email" ? draft.data.subject?.trim() || null : null,
      body: draft.data.body.trim(),
    },
    aiCalls,
    ms: Math.round(performance.now() - startedAt),
  };
}
