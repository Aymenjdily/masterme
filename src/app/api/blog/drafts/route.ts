import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createPost, sanityConfigured } from "@/lib/sanity";
import { sectionsToPortableText, slugify } from "@/lib/portable-text";

const bodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(400),
  sections: z.array(z.object({ heading: z.string().max(200), markdown: z.string().max(12000) })).min(1).max(20),
  /** true: live on the site now. false: unpublished draft. */
  publish: z.boolean().default(false),
});

/** Sends a post to Sanity: published (live now) or as an unpublished draft. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ error: "Sanity isn't connected. Add the SANITY_* values to .env.local." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, excerpt, sections, publish } = parsed.data;
  try {
    const draft = await createPost({
      publish,
      title,
      slug: slugify(parsed.data.slug || title) || slugify(title),
      excerpt,
      body: sectionsToPortableText(sections),
    });
    return Response.json(draft, { status: 201 });
  } catch (err) {
    console.error("[blog/drafts]", err);
    const status = (err as { statusCode?: number }).statusCode;
    const message =
      status === 401 || status === 403
        ? `Sanity rejected the token (${status}). Check SANITY_API_WRITE_TOKEN has Editor rights.`
        : "Couldn't save the post to Sanity.";
    return Response.json({ error: message }, { status: 502 });
  }
}
