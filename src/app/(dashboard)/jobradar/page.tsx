import type { Metadata } from "next";
import { JobRadarView } from "@/components/jobradar/JobRadarView";

export const metadata: Metadata = { title: "Job Radar" };

export default function JobRadarPage() {
  return <JobRadarView />;
}
