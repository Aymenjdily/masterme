import { createClient, type SanityClient } from "@sanity/client";
import type { PortableBlock } from "@/lib/portable-text";

// Server-only: uses SANITY_API_WRITE_TOKEN. MasterMe only reads posts and creates drafts;
// it never publishes and never deletes Sanity documents.

let client: SanityClient | null = null;

export function sanityConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID &&
    process.env.NEXT_PUBLIC_SANITY_DATASET &&
    process.env.SANITY_API_WRITE_TOKEN
  );
}

function sanity(): SanityClient {
  if (client) return client;
  if (!sanityConfigured()) throw new Error("Sanity is not configured");
  client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-27",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
    // Raw perspective so drafts (drafts.* ids) are visible next to published posts.
    perspective: "raw",
  });
  return client;
}

/** Link to a document in the Studio (drafts open under their published id). */
export function studioLink(id: string, type: "post" | "project" = "post") {
  const base = process.env.SANITY_STUDIO_URL?.replace(/\/$/, "");
  const docId = id.replace(/^drafts\./, "");
  if (!base) return `https://www.sanity.io/manage/project/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}`;
  return `${base}/structure/${type};${docId}`;
}

export type BlogPostRow = {
  id: string;
  title: string;
  status: "published" | "draft" | "no-date";
  date: string | null;
  studioUrl: string;
};

type RawPost = { _id: string; title?: string; publishedAt?: string | null; _updatedAt: string };

/** Latest posts, one row per post (a draft of a published post counts as that post). */
export async function listPosts(limit = 6): Promise<{ count: number; posts: BlogPostRow[] }> {
  const { rows, count } = await sanity().fetch<{ rows: RawPost[]; count: number }>(
    `{
      "rows": *[_type == "post"] | order(coalesce(publishedAt, _updatedAt) desc)[0...60]{ _id, title, publishedAt, _updatedAt },
      "count": count(*[_type == "post" && !(_id in path("drafts.**"))])
    }`
  );
  const published = new Set(rows.filter((r) => !r._id.startsWith("drafts.")).map((r) => r._id));
  const posts: BlogPostRow[] = [];
  for (const r of rows) {
    const isDraft = r._id.startsWith("drafts.");
    // A draft of an already-existing post is shown as that post.
    if (isDraft && published.has(r._id.slice("drafts.".length))) continue;
    posts.push({
      id: r._id,
      title: r.title || "Untitled",
      status: isDraft ? "draft" : r.publishedAt ? "published" : "no-date",
      date: r.publishedAt ?? r._updatedAt,
      studioUrl: studioLink(r._id),
    });
  }
  // Newest drafts first, then by date.
  posts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { count, posts: posts.slice(0, limit) };
}

/** Titles and excerpts of the last published posts, used to match the author's voice. */
export async function voiceSamples(limit = 5) {
  return sanity().fetch<{ title: string; excerpt: string | null }[]>(
    `*[_type == "post" && !(_id in path("drafts.**")) && defined(publishedAt)] | order(publishedAt desc)[0...$limit]{ title, excerpt }`,
    { limit }
  );
}

/** Every post title (published and drafts), for "already covered?" checks. */
export async function allTitles() {
  const titles = await sanity().fetch<string[]>(`*[_type == "post" && defined(title)].title`);
  return [...new Set(titles)];
}

async function slugTaken(slug: string, type: "post" | "project" = "post") {
  return (await sanity().fetch<number>(`count(*[_type == $type && slug.current == $slug])`, { slug, type })) > 0;
}

/** The slug, or slug-2, slug-3… if it's already used by a document of that type. */
export async function uniqueSlug(slug: string, type: "post" | "project") {
  let candidate = slug;
  for (let n = 2; await slugTaken(candidate, type); n++) candidate = `${slug}-${n}`;
  return candidate;
}

async function authorId() {
  return sanity().fetch<string | null>(`*[_type == "author" && !(_id in path("drafts.**"))][0]._id`);
}

/** Creates an unpublished draft post. Returns its id and Studio link. */
export async function createPostDraft(input: { title: string; slug: string; excerpt: string; body: PortableBlock[] }) {
  const author = await authorId();
  const slug = await uniqueSlug(input.slug, "post");

  // "drafts." lets Sanity generate the id and keeps the document unpublished.
  const doc = await sanity().create({
    _id: "drafts.",
    _type: "post",
    title: input.title,
    slug: { _type: "slug", current: slug },
    excerpt: input.excerpt,
    ...(author ? { author: { _type: "reference", _ref: author } } : {}),
    body: input.body,
  });
  return { id: doc._id, slug, studioUrl: studioLink(doc._id) };
}

/* ---------------- Portfolio projects ---------------- */

export type SanityProjectType = "client-work" | "product" | "project";
export type SanityProjectStatus = "live" | "beta";

export type ProjectRow = {
  id: string;
  title: string;
  type: SanityProjectType | null;
  status: SanityProjectStatus | null;
  year: string | null;
  draft: boolean;
  imageUrl: string | null;
  studioUrl: string;
};

type RawProject = {
  _id: string;
  title?: string;
  type?: SanityProjectType;
  status?: SanityProjectStatus;
  year?: string;
  imageUrl?: string | null;
  _updatedAt: string;
};

/** Latest portfolio projects, one row per project (a draft of an existing project counts as that project). */
export async function listProjects(limit = 5): Promise<{ count: number; projects: ProjectRow[] }> {
  const { rows, count } = await sanity().fetch<{ rows: RawProject[]; count: number }>(
    `{
      "rows": *[_type == "project"] | order(_updatedAt desc)[0...60]{ _id, title, type, status, year, _updatedAt, "imageUrl": mainImage.asset->url },
      "count": count(*[_type == "project" && !(_id in path("drafts.**"))])
    }`
  );
  const published = new Set(rows.filter((r) => !r._id.startsWith("drafts.")).map((r) => r._id));
  const projects = rows
    .filter((r) => !(r._id.startsWith("drafts.") && published.has(r._id.slice("drafts.".length))))
    .slice(0, limit)
    .map((r) => ({
      id: r._id,
      title: r.title || "Untitled",
      type: r.type ?? null,
      status: r.status ?? null,
      year: r.year ?? null,
      draft: r._id.startsWith("drafts."),
      imageUrl: r.imageUrl ? `${r.imageUrl}?w=120&h=80&fit=crop&auto=format` : null,
      studioUrl: studioLink(r._id, "project"),
    }));
  return { count, projects };
}

export const techKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Technology names already used on projects: normalized key → most common spelling. */
export async function projectTechnologies(): Promise<Map<string, string>> {
  const names = await sanity().fetch<string[]>(`*[_type == "project"].technologies[]`);
  const counts = new Map<string, Map<string, number>>();
  for (const name of names.filter(Boolean)) {
    const key = techKey(name);
    const spellings = counts.get(key) ?? new Map<string, number>();
    spellings.set(name, (spellings.get(name) ?? 0) + 1);
    counts.set(key, spellings);
  }
  return new Map(
    [...counts].map(([key, spellings]) => [key, [...spellings].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]])
  );
}

/** Two recent published projects, as style examples for the writing model. */
export async function projectStyleSamples() {
  return sanity().fetch<{ title: string; description: string; problem: string | null; solution: string | null }[]>(
    `*[_type == "project" && !(_id in path("drafts.**")) && defined(problem) && defined(solution)] | order(_updatedAt desc)[0...2]{ title, description, problem, solution }`
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};
const repoOf = (url: string) => url.toLowerCase().match(/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:[/?#]|$)/)?.[1] ?? null;

/** An existing project that already uses this site or repo, if any. */
export async function findProjectDuplicate(previewUrl: string | null, sourceUrl: string | null) {
  const rows = await sanity().fetch<{ _id: string; title: string; preview?: string; source?: string }[]>(
    `*[_type == "project"]{ _id, title, preview, source }`
  );
  const host = previewUrl ? hostOf(previewUrl) : null;
  const repo = sourceUrl ? repoOf(sourceUrl) : null;
  const match = rows.find(
    (r) =>
      (host && host !== "github.com" && [r.preview, r.source].some((u) => u && hostOf(u) === host)) ||
      (repo && [r.preview, r.source].some((u) => u && repoOf(u) === repo))
  );
  return match ? { id: match._id, title: match.title, studioUrl: studioLink(match._id, "project") } : null;
}

export type ProjectDraftInput = {
  title: string;
  slug: string;
  description: string;
  overview: string;
  problem: string;
  solution: string;
  businessImpact: string;
  body: PortableBlock[];
  type: SanityProjectType;
  status: SanityProjectStatus;
  year: string;
  featured: boolean;
  technologies: string[];
  preview: string | null;
  source: string | null;
  publishedAt: string;
  image: { data: Buffer; filename: string; contentType: string } | null;
};

/** Creates an unpublished draft project, uploading the cover image as an asset first. */
export async function createProjectDraft(input: ProjectDraftInput) {
  const [author, slug] = await Promise.all([authorId(), uniqueSlug(input.slug, "project")]);
  const asset = input.image
    ? await sanity().assets.upload("image", input.image.data, { filename: input.image.filename, contentType: input.image.contentType })
    : null;

  const doc = await sanity().create({
    _id: "drafts.",
    _type: "project",
    title: input.title,
    slug: { _type: "slug", current: slug },
    description: input.description,
    overview: input.overview,
    problem: input.problem,
    solution: input.solution,
    businessImpact: input.businessImpact,
    body: input.body,
    type: input.type,
    status: input.status,
    year: input.year,
    featured: input.featured,
    technologies: input.technologies,
    ...(input.preview ? { preview: input.preview } : {}),
    ...(input.source ? { source: input.source } : {}),
    publishedAt: input.publishedAt,
    ...(author ? { author: { _type: "reference", _ref: author } } : {}),
    ...(asset ? { mainImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } } } : {}),
  });
  return { id: doc._id, slug, studioUrl: studioLink(doc._id, "project") };
}
