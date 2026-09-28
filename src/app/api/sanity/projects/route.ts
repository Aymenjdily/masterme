import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createProjectDraft, listProjects, sanityConfigured } from "@/lib/sanity";
import { markdownToBlocks, slugify } from "@/lib/portable-text";
import { safeFetch } from "@/lib/site-reader";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/lib/ai/sanity-project-kinds";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Latest portfolio projects from Sanity, for the Portfolio card. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ configured: false, count: 0, projects: [], studioUrl: null });
  }
  try {
    const { count, projects } = await listProjects();
    return Response.json({ configured: true, count, projects, studioUrl: process.env.SANITY_STUDIO_URL ?? null });
  } catch (err) {
    console.error("[sanity/projects]", err);
    return Response.json({ error: "Couldn't reach Sanity." }, { status: 502 });
  }
}

const text = (max: number) => z.string().trim().max(max);
const optionalUrl = z.union([z.literal(""), z.string().trim().url().max(500)]).nullable();

const bodySchema = z.object({
  title: text(120).min(1),
  slug: text(120),
  description: text(300).min(1),
  overview: text(3000),
  problem: text(3000),
  solution: text(3000),
  businessImpact: text(3000),
  body: text(8000),
  type: z.enum(PROJECT_TYPES),
  status: z.enum(PROJECT_STATUSES),
  year: z.string().regex(/^\d{4}$/),
  featured: z.boolean(),
  technologies: z.array(text(60).min(1)).max(30),
  preview: optionalUrl,
  source: optionalUrl,
  publishedAt: z.iso.datetime(),
  image: optionalUrl,
});

/** Downloads the chosen cover image (public URLs only, images only, max 8 MB). */
async function downloadImage(url: string) {
  const res = await safeFetch(url, "image/*");
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !contentType.startsWith("image/")) throw new Error("The cover image couldn't be downloaded.");
  const data = Buffer.from(await res.arrayBuffer());
  if (data.byteLength > MAX_IMAGE_BYTES) throw new Error("The cover image is larger than 8 MB.");
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg").replace(/\+.*/, "") || "png";
  return { data, contentType, filename: `cover.${ext}` };
}

/** Sends a portfolio project to Sanity as an unpublished draft. Never publishes or overwrites. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ error: "Sanity isn't connected." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid project" }, { status: 400 });
  }
  const p = parsed.data;
  try {
    // A cover that can't be downloaded doesn't block the save; the Studio can add one later.
    const image = p.image ? await downloadImage(p.image).catch(() => null) : null;
    const draft = await createProjectDraft({
      ...p,
      slug: slugify(p.slug || p.title) || slugify(p.title) || "project",
      body: markdownToBlocks(p.body),
      technologies: [...new Set(p.technologies)],
      preview: p.preview || null,
      source: p.source || null,
      image,
    });
    return Response.json({ ...draft, imageSkipped: !!p.image && !image }, { status: 201 });
  } catch (err) {
    console.error("[sanity/projects POST]", err);
    const status = (err as { statusCode?: number }).statusCode;
    const message =
      status === 401 || status === 403
        ? `Sanity rejected the token (${status}). Check SANITY_API_WRITE_TOKEN has Editor rights.`
        : "Couldn't save the project to Sanity.";
    return Response.json({ error: message }, { status: 502 });
  }
}
