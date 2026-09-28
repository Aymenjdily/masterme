import { redirect } from "next/navigation";
import { sanityConfigured } from "@/lib/sanity";
import { ProjectFromLink } from "@/components/sanity-projects/ProjectFromLink";

export default function NewPortfolioProjectPage() {
  // Without Sanity there's nowhere to send projects.
  if (!sanityConfigured()) redirect("/portfolio");
  return <ProjectFromLink />;
}
