import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isDueForFollowUp } from "@/lib/follow-up";
import { parseDateParam } from "@/lib/date";
import { decide, score, type Question } from "@/lib/ai/decisions";
import { generateObject } from "@/lib/ai/openai";
import { aiRateLimited } from "@/lib/ai/log";
import { recommendedNoteTasks, TODO_TAG } from "@/lib/note-tasks";
import type {
  DayPlanResult,
  NotToday,
  PlanCounts,
  PlanInclude,
  PlanSource,
  PlanSuggestion,
} from "@/lib/ai/day-plan-kinds";

// AI day planner: collect open items, let the AI score them, place them by fixed rules, name them.
// Server-only. The AI never invents tasks: every suggestion is a real item or the lunch break.

const MAX_CANDIDATES = 12;
const RADAR_DAYS = 2;
const MAX_NOTES = 5;
const OPEN_STATUSES = new Set(["applied", "interviewing"]);

export const dayPlanRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  focus: z.string().trim().max(200).optional(),
  include: z.object({
    followups: z.boolean(),
    learning: z.boolean(),
    projects: z.boolean(),
    notes: z.boolean().default(false),
    radar: z.boolean(),
  }),
});

export function dayPlanRateLimited(userId: string) {
  return aiRateLimited(userId, "dayplan.", 20);
}

type Candidate = {
  key: string;
  source: Exclude<PlanSource, "break">;
  /** The real name of the item */
  name: string;
  /** Facts for the models */
  detail: string;
  why: string;
  count: number;
  noteId?: string;
};

function list(names: string[], max = 3) {
  return names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max}` : names.join(", ");
}

async function collect(userId: string, date: Date) {
  const [applications, recruiters, paths, projects, radar, notes] = await Promise.all([
    prisma.jobApplication.findMany({ where: { userId }, include: { jobOffer: true } }),
    prisma.recruiterContact.findMany({ where: { userId, lastContactedAt: { not: null }, endedAt: null } }),
    prisma.learningPath.findMany({
      where: { userId, status: "active" },
      include: { items: { where: { status: { not: "completed" } }, orderBy: { order: "asc" }, take: 1 } },
    }),
    prisma.project.findMany({ where: { userId, status: "active" }, orderBy: { updatedAt: "desc" } }),
    prisma.techNews.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - RADAR_DAYS * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    recommendedNoteTasks(userId, date, MAX_NOTES),
  ]);

  const dueApps = applications.filter(
    (a) => OPEN_STATUSES.has(a.status ?? "applied") && isDueForFollowUp(a.lastFollowUpAt ?? a.applicationDate)
  );
  const dueRecruiters = recruiters.filter((c) => c.lastContactedAt && isDueForFollowUp(c.lastContactedAt));
  const steps = paths.filter((p) => p.items.length > 0);

  return { dueApps, dueRecruiters, steps, projects, radar, notes };
}

/** Counts for the plan dialog (no AI). */
export async function planCounts(userId: string, date: Date): Promise<PlanCounts> {
  const { dueApps, dueRecruiters, steps, projects, radar, notes } = await collect(userId, date);
  return {
    followups: dueApps.length + dueRecruiters.length,
    learning: steps.length,
    projects: projects.length,
    notes: notes.total,
    radar: radar.length,
  };
}

async function candidates(userId: string, date: Date, include: PlanInclude): Promise<Candidate[]> {
  const { dueApps, dueRecruiters, steps, projects, radar, notes } = await collect(userId, date);
  const out: Candidate[] = [];

  if (include.followups && dueApps.length + dueRecruiters.length > 0) {
    const names = [...dueApps.map((a) => a.jobOffer.company), ...dueRecruiters.map((c) => c.name)];
    const count = names.length;
    out.push({
      key: "followups",
      source: "followups",
      name: `Follow-ups: ${list(names)}`,
      detail: `${count} follow-up message${count === 1 ? "" : "s"} due today (${names.join(", ")})`,
      why: `${count === 1 ? "due" : `${count} due`} · use Draft in Jobs to write ${count === 1 ? "it" : "them"}`,
      count,
    });
  }
  if (include.projects) {
    for (const p of projects) {
      out.push({
        key: `project:${p.id}`,
        source: "project",
        name: p.title,
        detail: `Active ${p.type} project "${p.title}"${p.clientName ? ` for ${p.clientName}` : ""}${p.description ? `: ${p.description.slice(0, 160)}` : ""}`,
        why: `${p.type === "saas" ? "SaaS" : p.type} project · active`,
        count: 1,
      });
    }
  }
  if (include.learning) {
    for (const path of steps) {
      const item = path.items[0];
      out.push({
        key: `learning:${item.id}`,
        source: "learning",
        name: `${path.title}: ${item.title}`,
        detail: `Next step "${item.title}" in the learning path "${path.title}"${item.status === "in_progress" ? " (already started)" : ""}`,
        why: `next step in "${path.title}"`,
        count: 1,
      });
    }
  }
  if (include.notes) {
    for (const note of notes.tasks) {
      const body = note.body.replace(/\s+/g, " ").trim().slice(0, 160);
      out.push({
        key: `note:${note.id}`,
        source: "notes",
        name: note.title,
        detail: `To-do from the user's notes: "${note.title}"${body ? `: ${body}` : ""}`,
        why: note.pinned ? `pinned #${TODO_TAG} note` : `tagged #${TODO_TAG} in Notes`,
        count: 1,
        noteId: note.id,
      });
    }
  }
  if (include.radar) {
    for (const n of radar) {
      out.push({
        key: `radar:${n.id}`,
        source: "radar",
        name: n.title,
        detail: `Tech news to read: "${n.title}"${n.tags.length ? ` (${n.tags.join(", ")})` : ""}`,
        why: "new on your radar",
        count: 1,
      });
    }
  }
  return out.slice(0, MAX_CANDIDATES);
}

const LEVEL_PRIORITY = { 2: "low", 3: "medium", 4: "high" } as const;
const MORNING_SOURCES = new Set<PlanSource>(["project", "followups", "notes"]);

const WHY_HERE: Record<PlanSource, (afternoon: boolean) => string> = {
  project: () => "Deep work goes first, while your head is fresh.",
  followups: () => "All due follow-ups in one block, right after deep work.",
  notes: () => "A concrete to-do from your notes, done early while you're fresh.",
  learning: (afternoon) =>
    afternoon ? "Learning goes after lunch, since your mornings hold project work." : "Learning fits here because the afternoon is taken.",
  radar: () => "Reading goes late in the day.",
  break: () => "A break around lunch after a few hours of work.",
};

const namingSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string().describe("Short block title, at most 60 characters, naming the real item"),
      description: z.string().nullable().describe("One short line, at most 90 characters, or null"),
    })
  ),
});

export async function planDay(
  userId: string,
  req: z.infer<typeof dayPlanRequestSchema>
): Promise<DayPlanResult | { error: "no-wake-up" | "day-full" | "nothing-open" }> {
  const startedAt = performance.now();
  const timeline = await prisma.timeline.findFirst({
    where: { userId, date: parseDateParam(req.date) },
    include: { blocks: true },
  });
  if (!timeline || timeline.wakeUpHour == null) return { error: "no-wake-up" };

  const wake = timeline.wakeUpHour;
  const clock = (slot: number) => (wake + slot) % 24;
  const taken = new Set(timeline.blocks.map((b) => b.hour));
  const free = Array.from({ length: 8 }, (_, s) => s).filter((s) => !taken.has(s));
  if (free.length === 0) return { error: "day-full" };

  const items = await candidates(userId, parseDateParam(req.date), req.include);
  if (items.length === 0) return { error: "nothing-open" };

  // 1. The AI scores each item: 1 = not today … 4 = high.
  const weekday = parseDateParam(req.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const questions: Record<string, Question> = {};
  items.forEach((item, i) => {
    questions[`c${i}`] = score(`How important is working on this today: ${item.detail}?`, 4, {
      1: "not today",
      2: "low",
      3: "medium",
      4: "high",
    });
  });
  const decision = await decide({
    userId,
    feature: "dayplan.score",
    state: [
      `Day: ${weekday}. The user has ${free.length} free one-hour blocks, starting at ${String(wake).padStart(2, "0")}:00.`,
      req.focus ? `What matters most to the user today: ${req.focus}` : "The user gave no focus for today.",
      `All open items:\n${items.map((it) => `- ${it.detail}`).join("\n")}`,
      "Due follow-ups and the user's focus matter most. Paused or unrelated work can wait.",
    ].join("\n\n"),
    questions,
    summary: { items: items.length, free: free.length, focus: !!req.focus },
  });
  const answers = decision.answers as Record<string, { score: number; confidence: number }>;

  const notToday: NotToday[] = [];
  const scored = items
    .map((item, i) => ({ item, level: answers[`c${i}`].score as 1 | 2 | 3 | 4, confidence: answers[`c${i}`].confidence }))
    .filter((s) => {
      if (s.level > 1) return true;
      notToday.push({ source: s.item.source, title: s.item.name, reason: `not today · ${Math.round(s.confidence * 100)}%` });
      return false;
    })
    .sort((a, b) => b.level - a.level);

  // 2. Fixed placement rules.
  const existingWork = timeline.blocks.length;
  const buffer = free.length >= 3 ? free[free.length - 1] : null;
  let slots = free.filter((s) => s !== buffer);
  const lunch = slots.find((s) => clock(s) === 12) ?? slots.find((s) => clock(s) === 13) ?? null;
  const wantsBreak = lunch !== null && existingWork + Math.min(scored.length, slots.length) >= 4;
  if (wantsBreak) slots = slots.filter((s) => s !== lunch);

  const chosen = scored.slice(0, slots.length);
  for (const s of scored.slice(slots.length)) {
    notToday.push({ source: s.item.source, title: s.item.name, reason: "no free block left" });
  }

  const morningFirst = chosen.filter((c) => MORNING_SOURCES.has(c.item.source));
  const later = chosen.filter((c) => !MORNING_SOURCES.has(c.item.source));
  const remaining = [...slots];
  const placed: { c: (typeof chosen)[number]; slot: number }[] = [];
  for (const c of morningFirst) placed.push({ c, slot: remaining.shift()! });
  for (const c of later) {
    const afternoon = remaining.find((s) => clock(s) >= 13);
    const slot = afternoon ?? remaining[0];
    remaining.splice(remaining.indexOf(slot), 1);
    placed.push({ c, slot });
  }

  // 3. Name the placed blocks (falls back to the real names if naming fails).
  let names = new Map<string, { title: string; description: string | null }>();
  let namingEventId: string | null = null;
  let aiCalls = 1;
  if (placed.length > 0) {
    try {
      const naming = await generateObject({
        userId,
        feature: "dayplan.name",
        name: "day_plan_titles",
        schema: namingSchema,
        system:
          "You write short, clear titles for a person's timeline blocks. Each title must name the real item it comes from. " +
          "Never invent tasks, numbers or details that are not in the item. English.",
        prompt: [
          req.focus ? `The user's focus today: ${req.focus}` : "",
          `Items:\n${placed.map((p, i) => `id=${i}: ${p.c.item.detail}`).join("\n")}`,
        ].join("\n\n"),
        summary: { items: placed.length },
      });
      aiCalls++;
      namingEventId = naming.eventId;
      names = new Map(naming.data.items.map((n) => [n.id, { title: n.title.slice(0, 80), description: n.description?.slice(0, 140) ?? null }]));
    } catch (err) {
      console.error("[dayplan.name] falling back to item names:", err);
    }
  }

  const suggestions: PlanSuggestion[] = placed.map(({ c, slot }, i) => ({
    key: c.item.key,
    slot,
    title: names.get(String(i))?.title || c.item.name,
    description: names.get(String(i))?.description ?? null,
    priority: LEVEL_PRIORITY[c.level as 2 | 3 | 4],
    source: c.item.source,
    count: c.item.count,
    confidence: c.confidence,
    why: c.item.why,
    whyHere: WHY_HERE[c.item.source](clock(slot) >= 13),
    ...(c.item.noteId ? { noteId: c.item.noteId } : {}),
  }));

  if (wantsBreak && lunch !== null) {
    const hours = existingWork + placed.length;
    suggestions.push({
      key: "break",
      slot: lunch,
      title: "Lunch break",
      description: null,
      priority: "low",
      source: "break",
      count: 0,
      confidence: null,
      why: `you have ${hours} hours of work planned`,
      whyHere: WHY_HERE.break(true),
    });
  }

  return {
    suggestions: suggestions.sort((a, b) => a.slot - b.slot),
    notToday,
    bufferSlot: buffer,
    openCount: items.length,
    decisionEventId: decision.eventId,
    namingEventId,
    aiCalls,
    ms: Math.round(performance.now() - startedAt),
  };
}
