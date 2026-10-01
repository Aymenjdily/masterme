import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Providers } from "./providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/");
  }

  return (
    <Providers>
      <SidebarProvider
        className="bg-background p-4"
        style={{ "--sidebar-width": "300px" } as React.CSSProperties}
      >
        <DashboardSidebar />
        <div className="flex flex-1 flex-col gap-4">
          <AppHeader
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
          />
          <main className="flex-1">{children}</main>
        </div>
      </SidebarProvider>
    </Providers>
  );
}
