import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listPosts, sanityConfigured } from "@/lib/sanity";

/** Latest blog posts from Sanity for the Portfolio blog card. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ configured: false, count: 0, posts: [], studioUrl: null });
  }
  try {
    const { count, posts } = await listPosts();
    return Response.json({ configured: true, count, posts, studioUrl: process.env.SANITY_STUDIO_URL ?? null });
  } catch (err) {
    console.error("[blog/posts]", err);
    return Response.json({ error: "Couldn't reach Sanity." }, { status: 502 });
  }
}
