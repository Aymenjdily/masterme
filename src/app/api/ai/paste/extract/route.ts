import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { PASTE_KINDS, extractPaste, pasteRateLimited, pasteTextSchema } from "@/lib/ai/paste";

const bodySchema = z.object({ text: pasteTextSchema, kind: z.enum(PASTE_KINDS) });

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (await pasteRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  try {
    return Response.json(await extractPaste(session.user.id, parsed.data.text, parsed.data.kind));
  } catch (err) {
    console.error("[paste.extract]", err);
    return Response.json({ error: "The AI couldn't fill the fields right now." }, { status: 502 });
  }
}
