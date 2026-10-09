"use client";

import { ExternalLink, MapPin, Building2, Clock, ChevronDown, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobOffer } from "@/types";
import { Button } from "@/components/ui/button";
import {
  countryLabel,
  postedLabel,
  RADAR_STATUSES,
  RADAR_STATUS_DOTS,
  scoreColor,
  scoreMeta,
  workplaceLabel,
  type RadarStatus,
} from "@/components/jobradar/radar-utils";

export function RadarJobCard({
  job,
  onStatus,
  onOpen,
  busy,
}: {
  job: JobOffer;
  onStatus: (status: RadarStatus) => void;
  onOpen: () => void;
  busy: boolean;
}) {
  const matched = job.technologiesMatched ?? [];
  const missing = job.technologiesMissing ?? [];

  return (
    <li className="px-4.5 py-4 [--card-spacing:0] transition-colors first:rounded-t-[18px] hover:bg-muted/40">
      <div className="flex items-start gap-3.5">
        <div className="flex w-10 flex-col items-center gap-1">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full font-mono text-[0.9rem] font-semibold text-card-foreground",
              scoreColor(job.matchScore),
              (job.matchScore ?? 0) >= 80 ? "text-black" : "text-white"
            )}
            title={scoreMeta(job.matchScore)}
          >
            {job.matchScore ?? "?"}
          </div>
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-muted-foreground">
            match
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[0.9375rem] font-medium">{job.title}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", RADAR_STATUS_DOTS[job.status] ?? "bg-muted-foreground")} />
              {RADAR_STATUSES.find((s) => s.value === job.status)?.label ?? job.status}
            </span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8125rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" />
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {job.location ? `${countryLabel(job.country)} · ${job.location}` : countryLabel(job.country)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {postedLabel(job.postedDate) || "unknown date"}
            </span>
            <span>{workplaceLabel(job.workplaceType)}</span>
            {job.employmentType && <span>{job.employmentType}</span>}
          </p>

          {(matched.length > 0 || missing.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matched.slice(0, 6).map((tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-success/15 px-2 py-0.5 text-[0.6875rem] font-medium text-success-strong"
                >
                  {tech}
                </span>
              ))}
              {missing.slice(0, 4).map((tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" render={<a href={job.url} target="_blank" rel="noreferrer noopener" />} nativeButton={false}>
            <ExternalLink />
            Apply
          </Button>
          <select
            aria-label="Job status"
            disabled={busy}
            value={job.status}
            onChange={(e) => onStatus(e.target.value as RadarStatus)}
            className="h-8.5 cursor-pointer rounded-lg border border-input bg-card px-2 text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50"
          >
            {RADAR_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onStatus("not_interested")}
            disabled={busy || job.status === "not_interested"}
            aria-label="I don't like this job"
            title="I don't like it"
            className="text-muted-foreground hover:text-destructive-strong"
          >
            <ThumbsDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpen} aria-label="Show job details">
            <ChevronDown className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

export function RadarJobReasonList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-4.5">
      {reasons.map((reason, i) => (
        <li key={i} className="text-[0.8125rem] text-muted-foreground">
          {reason}
        </li>
      ))}
    </ul>
  );
}

export function RadarTagList({
  merged,
  matched,
}: {
  merged: string[];
  matched: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {merged.map((tech) => {
        const isMatched = matched.includes(tech);
        return (
          <span
            key={tech}
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.6875rem] font-medium",
              isMatched
                ? "bg-success/15 text-success-strong"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isMatched ? `${tech} ✓` : tech}
          </span>
        );
      })}
    </div>
  );
}
