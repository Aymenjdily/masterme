import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { followUpRateLimited, followUpRequestSchema, writeFollowUp } from "@/lib/ai/follow-up";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = followUpRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (await followUpRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const result = await writeFollowUp(session.user.id, session.user.name || "", parsed.data);
    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[followup]", err);
    return Response.json({ error: "The AI didn't answer in time." }, { status: 502 });
  }
}
