import type { Gate } from "@/lib/ai/confidence";

// Shared by the Paste anything routes and the dialog (no server imports here).

export const PASTE_KINDS = ["recruiter", "application", "learning", "radar", "portfolio"] as const;
export type PasteKind = (typeof PASTE_KINDS)[number];

export type ClassifyResult = {
  eventId: string | null;
  kind: PasteKind | "other";
  probabilities: Record<PasteKind | "other", number>;
  confidence: number;
  gate: Gate;
  ms: number;
};

export type PathOption = { id: string; title: string; probability: number };
export type StackGuess = { skill: string | null; probability: number };

export type ExtractResult = {
  eventId: string | null;
  routeEventId: string | null;
  kind: PasteKind;
  fields: Record<string, string | null>;
  /** recruiter: does the text also describe a specific opening? */
  alsoApplication?: { value: boolean; probability: number };
  /** learning: the user's active paths, most likely first */
  paths?: PathOption[];
  /** radar: which skill from the user's stack it's about */
  stack?: StackGuess;
  ms: number;
};
