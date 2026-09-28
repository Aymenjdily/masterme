// Shared by the Sanity project routes and the "Add from link" page (no server imports here).

export const PROJECT_TYPES = ["client-work", "product", "project"] as const;
export type ProjectKind = (typeof PROJECT_TYPES)[number];
export const PROJECT_STATUSES = ["live", "beta"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type TechTag = { name: string; isNew: boolean };

export type SanityProjectDraft = {
  title: string;
  slug: string;
  description: string;
  overview: string;
  problem: string;
  solution: string;
  /** One point per line */
  businessImpact: string;
  /** Paragraphs separated by a blank line */
  body: string;
  type: ProjectKind;
  status: ProjectStatus;
  year: string;
  featured: boolean;
  technologies: TechTag[];
  preview: string | null;
  source: string | null;
  publishedAt: string;
  /** Cover image candidates that load, best first; `image` is the chosen one */
  images: string[];
  image: string | null;
};

export type ProjectFound = {
  site: { title: string | null; words: number; loginOnly: boolean; imageCount: number } | { error: string } | null;
  repo: { fullName: string; readme: boolean; dependencies: number } | { error: string } | null;
  /** Technologies read from package.json */
  stack: string[];
  duplicate: { title: string; studioUrl: string } | null;
  projectCount: number;
};

export type GenerateProjectResult = {
  found: ProjectFound;
  draft: SanityProjectDraft;
  probabilities: { type: Record<ProjectKind, number>; status: Record<ProjectStatus, number> };
  eventIds: string[];
  aiCalls: number;
  ms: number;
};

export const TYPE_LABEL: Record<ProjectKind, string> = { "client-work": "Client", product: "Product", project: "Project" };
export const STATUS_LABEL: Record<ProjectStatus, string> = { live: "Live", beta: "Beta" };
