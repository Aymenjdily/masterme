import { redirect } from "next/navigation";

// Applications/recruiters tracking stayed behind JobRadar; the old Jobs page
// deep-links (header, paste-anything, day planner, dashboard widgets) now land
// on the radar, which is the only career surface in the nav.
export default function JobsPage() {
  redirect("/jobradar");
}
