import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const firstName = session.user.name?.split(/\s+/)[0] || "there";
  return <DashboardView firstName={firstName} />;
}
