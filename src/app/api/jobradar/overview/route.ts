import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getJobRadarOverview } from "@/lib/jobradar/overview";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getJobRadarOverview(session.user.id);
  return Response.json(overview);
}
