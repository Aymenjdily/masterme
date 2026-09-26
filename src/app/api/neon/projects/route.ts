import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listNeonProjects } from "@/lib/neon";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listNeonProjects();
    return Response.json({ projects });
  } catch (err) {
    console.error("[api/neon/projects]", err);
    return Response.json({ projects: [], error: "Neon unavailable" });
  }
}
