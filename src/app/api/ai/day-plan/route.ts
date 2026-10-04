import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { dayPlanRateLimited, dayPlanRequestSchema, planCounts, planDay } from "@/lib/ai/day-plan";
import { isValidDateParam, parseDateParam, todayDateParam } from "@/lib/date";

/** Open item counts for the plan dialog (no AI call). */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? "";
  return Response.json(await planCounts(session.user.id, parseDateParam(isValidDateParam(date) ? date : todayDateParam())));
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = dayPlanRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (await dayPlanRateLimited(session.user.id)) {
    return Response.json({ error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const result = await planDay(session.user.id, parsed.data);
    if ("error" in result) {
      const message = {
        "no-wake-up": "Set your wake-up hour first.",
        "day-full": "All 8 blocks are filled.",
        "nothing-open": "Nothing open to plan.",
      }[result.error];
      return Response.json({ error: message, code: result.error }, { status: 409 });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[dayplan]", err);
    return Response.json({ error: "The AI didn't answer in time." }, { status: 502 });
  }
}
