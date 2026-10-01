import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unseenErrorCount } from "@/lib/project-logs";

// The sidebar badge: errors since the user last opened /logs.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ unseen: await unseenErrorCount(session.user.id) });
}

// Called when /logs is opened.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { logsSeenAt: new Date() } });
  return Response.json({ unseen: 0 });
}
