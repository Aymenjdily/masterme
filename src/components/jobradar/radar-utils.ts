import type { JobOffer } from "@/types";
import { shortAgo } from "@/components/jobs/job-utils";

export type RadarStatus =
  | "new"
  | "interested"
  | "to_apply"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "accepted"
  | "archived"
  | "not_interested";

export const RADAR_STATUSES: { value: RadarStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "interested", label: "Interested" },
  { value: "to_apply", label: "To apply" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "not_interested", label: "I don't like" },
  { value: "archived", label: "Archived" },
];

export const RADAR_STATUS_DOTS: Record<string, string> = {
  new: "bg-primary",
  interested: "bg-info",
  to_apply: "bg-warning-strong",
  applied: "bg-primary",
  interviewing: "bg-special",
  offer: "bg-success",
  rejected: "bg-destructive",
  accepted: "bg-success",
  not_interested: "bg-destructive",
  archived: "bg-muted-foreground",
};

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-muted-foreground";
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-special";
  if (score >= 40) return "bg-warning-strong";
  return "bg-muted-foreground";
}

export function scoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "?";
  return String(score);
}

export function scoreMeta(score: number | null | undefined): string {
  if (score === null || score === undefined) return "not scored yet";
  if (score >= 80) return "excellent match";
  if (score >= 60) return "good match";
  if (score >= 40) return "weak match";
  return "not relevant";
}

export function countryLabel(country: string | null | undefined): string {
  switch (country) {
    case "morocco":
      return "Morocco";
    case "france":
      return "France";
    case "saudi_arabia":
      return "Saudi Arabia";
    case "uk":
      return "United Kingdom";
    default:
      return "Unknown";
  }
}

export function workplaceLabel(workplaceType: string | null | undefined): string {
  switch (workplaceType) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "On-site";
    default:
      return "Unknown";
  }
}

export function postedLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return shortAgo(iso);
}

export type FeedFilters = {
  country: "all" | "morocco" | "france" | "saudi_arabia" | "uk";
  workplace: "all" | "remote" | "hybrid" | "onsite";
  status: "all" | RadarStatus;
  applied: "all" | "applied" | "not_applied" | "not_interested";
  minScore: number;
  search: string;
};

const APPLIED_STATUSES: ReadonlySet<string> = new Set([
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "accepted",
]);

export const APPLIED_SIDE = APPLIED_STATUSES;

export function filterRadarJobs(jobs: JobOffer[], f: FeedFilters): JobOffer[] {
  const q = f.search.trim().toLowerCase();
  return jobs.filter((job) => {
    if (f.country !== "all" && job.country !== f.country) return false;
    if (f.workplace !== "all" && job.workplaceType !== f.workplace) return false;
    if (f.status !== "all" && job.status !== f.status) return false;
    if (f.applied === "applied" && !APPLIED_STATUSES.has(job.status)) return false;
    if (
      f.applied === "not_applied" &&
      (APPLIED_STATUSES.has(job.status) || job.status === "archived" || job.status === "not_interested")
    )
      return false;
    if (f.minScore > 0 && (job.matchScore ?? 0) < f.minScore) return false;
    if (
      q &&
      !(
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.technologies ?? []).some((t) => t.toLowerCase().includes(q))
      )
    ) {
      return false;
    }
    return true;
  });
}

export function sortRadarJobs(jobs: JobOffer[]): JobOffer[] {
  return jobs.slice().sort((a, b) => {
    const scoreDiff = (b.matchScore ?? -1) - (a.matchScore ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    const aDate = a.postedDate ? new Date(a.postedDate).getTime() : 0;
    const bDate = b.postedDate ? new Date(b.postedDate).getTime() : 0;
    return bDate - aDate;
  });
}
