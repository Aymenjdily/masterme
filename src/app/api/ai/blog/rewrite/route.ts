import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { blogRateLimited, rewriteRequestSchema, rewriteSection } from "@/lib/ai/blog";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = rewriteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (await blogRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  try {
    return Response.json(await rewriteSection(session.user.id, parsed.data));
  } catch (err) {
    console.error("[blog.rewrite]", err);
    return Response.json({ error: "The AI couldn't rewrite this section." }, { status: 502 });
  }
}
