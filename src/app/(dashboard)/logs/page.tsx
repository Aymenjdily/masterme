import { LogsView } from "@/components/logs/LogsView";

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ project?: string | string[] }> }) {
  const { project } = await searchParams;
  return <LogsView initialProject={typeof project === "string" && project ? project : "all"} />;
}
