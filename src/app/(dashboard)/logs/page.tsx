import type { Metadata } from "next";
import { LogsView } from "@/components/logs/LogsView";

export const metadata: Metadata = { title: "Logs" };

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ project?: string | string[] }> }) {
  const { project } = await searchParams;
  return <LogsView initialProject={typeof project === "string" && project ? project : "all"} />;
}
