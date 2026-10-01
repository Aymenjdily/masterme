"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/assets/logo/logo";
import { NavItem, NavMain } from "@/components/shadcn-space/blocks/sidebar-06/nav-main";
import {
  LayoutDashboard,
  Globe,
  BookOpen,
  Clock,
  Briefcase,
  FolderKanban,
  Newspaper,
  Settings,
  SquareTerminal,
  Wallet,
} from "lucide-react";

export const navData: NavItem[] = [
  // Dashboards Section
  { label: "Dashboards", isSection: true },
  { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },

  // Life Management Section
  { label: "Life Management", isSection: true },
  { title: "Portfolio", icon: Globe, href: "/portfolio" },
  { title: "Learning", icon: BookOpen, href: "/learning" },
  { title: "Timeline", icon: Clock, href: "/timeline" },
  { title: "Monthly Cost", icon: Wallet, href: "/monthly-cost" },

  // Career & Business Section
  { label: "Career & Business", isSection: true },
  { title: "Jobs", icon: Briefcase, href: "/jobs" },
  { title: "Projects", icon: FolderKanban, href: "/projects" },
  { title: "Logs", icon: SquareTerminal, href: "/logs" },
  { title: "Tech News", icon: Newspaper, href: "/news" },

  // Account Section
  { label: "Account", isSection: true },
  { title: "Settings", icon: Settings, href: "/settings" },
];

/** `badges` maps an item's href to a small red count (e.g. unseen log errors). */
export function AppSidebar({ badges }: { badges?: Record<string, number | undefined> }) {
  const items = badges ? navData.map((item) => (item.href && badges[item.href] ? { ...item, badge: badges[item.href] } : item)) : navData;

  return (
    <Sidebar
      variant="floating"
      className="p-4 h-full [&_[data-slot=sidebar-inner]]:rounded-2xl [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-sidebar-border [&_[data-slot=sidebar-inner]]:bg-sidebar [&_[data-slot=sidebar-inner]]:shadow-card [&_[data-slot=sidebar-inner]]:ring-0"
    >
      <div className="flex flex-col gap-6 overflow-hidden pt-4">
        {/* ---------------- Header ---------------- */}
        <SidebarHeader className="px-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <a href="/" className="w-full h-full">
                <Logo />
              </a>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* ---------------- Content ---------------- */}
        <SidebarContent className="overflow-hidden">
          <ScrollArea className="h-[calc(100vh-100px)]">
            <div className="px-4">
              <NavMain items={items} />
            </div>
          </ScrollArea>
        </SidebarContent>
      </div>
    </Sidebar>
  );
}
