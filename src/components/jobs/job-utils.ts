import type { JobApplication } from "@/types";

export type ApplicationStatus = "applied" | "interviewing" | "rejected" | "accepted";

export const APPLICATION_STATUS: Record<
  ApplicationStatus,
  { label: string; variant: "warning" | "special" | "destructive" | "success"; dot: string }
> = {
  applied: { label: "Applied", variant: "warning", dot: "bg-primary" },
  interviewing: { label: "Interviewing", variant: "special", dot: "bg-special" },
  rejected: { label: "Rejected", variant: "destructive", dot: "bg-destructive" },
  accepted: { label: "Accepted", variant: "success", dot: "bg-success" },
};

export function applicationStatus(application: JobApplication): ApplicationStatus {
  const status = application.status ?? "applied";
  return status in APPLICATION_STATUS ? (status as ApplicationStatus) : "applied";
}

export function isClosed(application: JobApplication) {
  const status = applicationStatus(application);
  return status === "rejected" || status === "accepted";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function shortAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  return days <= 0 ? "today" : `${days}d ago`;
}

export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-US", { month: "short" })}`;
}

export function initials(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0] ?? "?";
  return word[0].toUpperCase() + (word[1] ?? "");
}

/** Manual entries without a real link get a placeholder `manual://` URL server-side. */
export function realUrl(url?: string) {
  return url && /^https?:\/\//.test(url) ? url : undefined;
}
