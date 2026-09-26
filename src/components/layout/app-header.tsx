"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, Briefcase, ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import type { NotificationsSummary } from "@/types";
import { navData } from "@/components/shadcn-space/blocks/sidebar-06/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PasteButton } from "@/components/ai/PasteButton";
import { ToastHost } from "@/components/ai/Toast";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type HeaderUser = {
  name: string;
  email: string;
  image?: string | null;
};

const SUMMARY_REFRESH_MS = 5 * 60 * 1000;

async function fetchSummary(): Promise<NotificationsSummary> {
  const res = await fetch("/api/notifications/summary");
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json();
}

function usePageTitle() {
  const pathname = usePathname();
  const match = navData.find(
    (item) =>
      !item.isSection &&
      item.href &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
  );
  return match?.title ?? null;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppHeader({ user }: { user: HeaderUser }) {
  const pageTitle = usePageTitle();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 rounded-2xl border bg-card px-3 shadow-card sm:px-4">
      <SidebarTrigger className="cursor-pointer text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="h-5! self-center!" />

      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className={pageTitle ? "text-muted-foreground" : "font-medium text-foreground"}>
          MasterMe
        </span>
        {pageTitle && (
          <>
            <span aria-hidden className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="truncate font-medium text-foreground">
              {pageTitle}
            </span>
          </>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <PasteButton />
        <span
          suppressHydrationWarning
          className="hidden pr-2 font-mono text-xs text-muted-foreground md:inline"
        >
          {today}
        </span>
        <NotificationsBell />
        <UserMenu user={user} />
      </div>
      <ToastHost />
    </header>
  );
}

function NotificationsBell() {
  const { data } = useQuery({
    queryKey: queryKeys.notificationsSummary,
    queryFn: fetchSummary,
    refetchInterval: SUMMARY_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const rows = [
    { key: "offers", count: data?.newOffers ?? 0, label: "new job offers", icon: Briefcase, tone: "bg-info/10 text-info-strong" },
    { key: "applications", count: data?.applicationsDue ?? 0, label: "applications to follow up", icon: BellRing, tone: "bg-warning/15 text-warning-strong" },
    { key: "contacts", count: data?.contactsDue ?? 0, label: "recruiters to follow up", icon: UserRound, tone: "bg-special/10 text-special-strong" },
  ].filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label={total > 0 ? `Notifications, ${total} pending` : "Notifications"}
          />
        }
      >
        <Bell className="size-[18px]" />
        {total > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.625rem] font-medium text-primary-foreground ring-2 ring-card">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <PopoverTitle>Notifications</PopoverTitle>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-2 py-6 text-center">
            <Bell className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground">New offers and follow-ups will show here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {rows.map((row) => (
              <li key={row.key}>
                <Link
                  href="/jobs"
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
                >
                  <span className={`flex size-8 items-center justify-center rounded-lg ${row.tone}`}>
                    <row.icon className="size-4" />
                  </span>
                  <span className="text-sm">
                    <span className="font-mono font-medium">{row.count}</span> {row.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const firstName = user.name.split(/\s+/)[0] || user.name;

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2 pl-1 outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20 data-popup-open:bg-muted"
      >
        <Avatar className="size-8 ring-2 ring-primary ring-offset-2 ring-offset-card">
          <AvatarImage src={user.image || "/images/avatar.png"} alt="" />
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium md:inline">{firstName}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link href="/settings" />}>
          <Settings />
          Settings
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
