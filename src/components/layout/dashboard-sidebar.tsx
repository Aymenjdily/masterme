"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { AppSidebar } from "@/components/shadcn-space/blocks/sidebar-06/app-sidebar";

async function fetchUnseenLogs(): Promise<{ unseen: number }> {
  const res = await fetch("/api/logs/seen");
  if (!res.ok) throw new Error("Failed to load logs badge");
  return res.json();
}

/** The app sidebar with live badges: errors since /logs was last opened. */
export function DashboardSidebar() {
  const { data: logs } = useQuery({
    queryKey: queryKeys.logsUnseen,
    queryFn: fetchUnseenLogs,
    refetchInterval: 60 * 1000,
  });
  return <AppSidebar badges={{ "/logs": logs?.unseen }} />;
}
