import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sanityConfigured } from "@/lib/sanity";
import { blogRateLimited, suggestTopics } from "@/lib/ai/blog";

/** Three topic ideas from the user's projects, learning and radar, ranked by fit, plus the blog's language. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ error: "Sanity isn't connected." }, { status: 400 });
  }
  if (await blogRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  try {
    return Response.json(await suggestTopics(session.user.id));
  } catch (err) {
    console.error("[blog.suggest]", err);
    return Response.json({ error: "The AI couldn't suggest topics right now." }, { status: 502 });
  }
}
