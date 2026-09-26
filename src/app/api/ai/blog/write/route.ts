import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sanityConfigured } from "@/lib/sanity";
import { blogRateLimited, writePost, writeRequestSchema } from "@/lib/ai/blog";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ error: "Sanity isn't connected." }, { status: 400 });
  }
  const parsed = writeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (await blogRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  try {
    return Response.json(await writePost(session.user.id, parsed.data));
  } catch (err) {
    console.error("[blog.write]", err);
    return Response.json({ error: "The AI didn't finish the draft. Try again." }, { status: 502 });
  }
}
