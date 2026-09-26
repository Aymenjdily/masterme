import type { BlogSection } from "@/lib/portable-text";

// Shared by the blog routes and the writer UI (no server imports here).

export type BlogSourceKind = "project" | "learning" | "radar";
export type BlogLanguage = "en" | "fr";
export type BlogLength = "short" | "medium" | "long";

export type TopicSuggestion = {
  /** e.g. "project:<id>" — sent back when writing so the server loads the real facts */
  sourceKey: string;
  source: { kind: BlogSourceKind; name: string };
  title: string;
  /** Probability the topic scores 4–5 out of 5 for this blog */
  fit: number;
};

export type SuggestResult = {
  topics: TopicSuggestion[];
  language: { choice: BlogLanguage; probabilities: Record<BlogLanguage, number> };
  eventIds: string[];
};

export type BlogDraft = {
  title: string;
  slug: string;
  excerpt: string;
  sections: BlogSection[];
};

export type WriteResult =
  | { covered: { title: string; probability: number }; eventId: string | null }
  | { draft: BlogDraft; factsUsed: string[]; eventIds: string[]; ms: number };

export const LENGTH_WORDS: Record<BlogLength, number> = { short: 500, medium: 1000, long: 1600 };
