import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listVercelProjects, vercelConfigured } from "@/lib/vercel";

// The Vercel project picker in the project form.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!vercelConfigured()) {
    return Response.json({ projects: [], configured: false });
  }

  try {
    return Response.json({ projects: await listVercelProjects(), configured: true });
  } catch (err) {
    console.error("[api/vercel/projects]", err);
    return Response.json({ projects: [], configured: true, error: "Vercel unavailable" });
  }
}
