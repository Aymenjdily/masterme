import type { Metadata } from "next";
import { todayDateParam, isValidDateParam } from "@/lib/date";
import { TimelineView } from "@/components/timeline/TimelineView";

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage(props: PageProps<"/timeline">) {
  const searchParams = await props.searchParams;
  const rawDate = searchParams.date;
  const today = todayDateParam();
  const date =
    typeof rawDate === "string" && isValidDateParam(rawDate) ? rawDate : today;

  return <TimelineView date={date} today={today} />;
}
