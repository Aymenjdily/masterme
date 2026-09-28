import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { sanityConfigured } from "@/lib/sanity";
import { generateProject, generateRequestSchema, projectRateLimited } from "@/lib/ai/sanity-project";

/** Reads the site (+ repo) and fills every field of a Sanity portfolio project. Nothing is saved here. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sanityConfigured()) {
    return Response.json({ error: "Sanity isn't connected." }, { status: 400 });
  }
  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  if (await projectRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }
  try {
    return Response.json(await generateProject(session.user.id, parsed.data));
  } catch (err) {
    console.error("[sanityproject.generate]", err);
    return Response.json({ error: err instanceof Error ? err.message : "Couldn't read that project." }, { status: 502 });
  }
}
