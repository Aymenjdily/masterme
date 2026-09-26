// Shared by the day-plan route and the timeline UI (no server imports here).

export type PlanSource = "project" | "followups" | "learning" | "radar" | "break";

export type PlanInclude = { followups: boolean; learning: boolean; projects: boolean; radar: boolean };

export type PlanCounts = { followups: number; learning: number; projects: number; radar: number };

export type PlanSuggestion = {
  key: string;
  /** Timeline slot 0–7 */
  slot: number;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  source: PlanSource;
  /** Items merged into this block (follow-ups) */
  count: number;
  /** Probability of the chosen priority; null for the lunch break */
  confidence: number | null;
  /** From the data, e.g. "next step in an active path" */
  why: string;
  /** Why this slot, from the placement rules */
  whyHere: string;
};

export type NotToday = { source: PlanSource; title: string; reason: string };

export type DayPlanResult = {
  suggestions: PlanSuggestion[];
  notToday: NotToday[];
  /** Free slot left empty on purpose */
  bufferSlot: number | null;
  openCount: number;
  decisionEventId: string | null;
  namingEventId: string | null;
  aiCalls: number;
  ms: number;
};

export const SOURCE_LABEL: Record<PlanSource, string> = {
  project: "Project",
  followups: "Follow-ups",
  learning: "Learning",
  radar: "Radar",
  break: "Break",
};
