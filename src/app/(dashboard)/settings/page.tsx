import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <SettingsView
      user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
    />
  );
}
