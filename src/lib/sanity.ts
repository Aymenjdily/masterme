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

/** Link to a post in the Studio (drafts open under their published id). */
export function studioLink(id: string) {
  const base = process.env.SANITY_STUDIO_URL?.replace(/\/$/, "");
  const docId = id.replace(/^drafts\./, "");
  if (!base) return `https://www.sanity.io/manage/project/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}`;
  return `${base}/structure/post;${docId}`;
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

async function slugTaken(slug: string) {
  return (await sanity().fetch<number>(`count(*[_type == "post" && slug.current == $slug])`, { slug })) > 0;
}

/** Creates an unpublished draft post. Returns its id and Studio link. */
export async function createPostDraft(input: { title: string; slug: string; excerpt: string; body: PortableBlock[] }) {
  const authorId = await sanity().fetch<string | null>(`*[_type == "author" && !(_id in path("drafts.**"))][0]._id`);

  let slug = input.slug;
  for (let n = 2; await slugTaken(slug); n++) slug = `${input.slug}-${n}`;

  // "drafts." lets Sanity generate the id and keeps the document unpublished.
  const doc = await sanity().create({
    _id: "drafts.",
    _type: "post",
    title: input.title,
    slug: { _type: "slug", current: slug },
    excerpt: input.excerpt,
    ...(authorId ? { author: { _type: "reference", _ref: authorId } } : {}),
    body: input.body,
  });
  return { id: doc._id, slug, studioUrl: studioLink(doc._id) };
}
