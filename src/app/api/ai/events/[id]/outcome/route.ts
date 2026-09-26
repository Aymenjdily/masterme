import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { setAiEventOutcome } from "@/lib/ai/log";

const bodySchema = z.object({ outcome: z.enum(["accepted", "edited", "rejected"]) });

/** Records what the user did with an AI suggestion. */
export async function POST(request: Request, ctx: RouteContext<"/api/ai/events/[id]/outcome">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await ctx.params;
  const updated = await setAiEventOutcome(session.user.id, id, parsed.data.outcome);
  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ success: true });
}
