"use client";

import { BellRing, Check, ChevronDown, ExternalLink, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DraftButton } from "@/components/ai/DraftButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { tintAt } from "@/components/portfolio/shared";
import {
  APPLICATION_STATUS,
  applicationStatus,
  daysAgo,
  initials,
  isClosed,
  realUrl,
  shortAgo,
  shortDate,
  type ApplicationStatus,
} from "@/components/jobs/job-utils";

const iconButtonClass =
  "size-7.5 cursor-pointer rounded-lg text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-xs";

export function ApplicationRow({
  application,
  onStatus,
  onFollowedUp,
  onEdit,
  onDelete,
  followingUp,
}: {
  application: JobApplication;
  onStatus: (status: ApplicationStatus) => void;
  onFollowedUp: () => void;
  onEdit: () => void;
  onDelete: () => void;
  followingUp: boolean;
}) {
  const status = applicationStatus(application);
  const closed = isClosed(application);
  const offer = application.jobOffer;
  const company = offer?.company ?? "Company";
  const url = realUrl(offer?.url);
  const hash = [...company].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return (
    <li
      className={cn(
        "group grid grid-cols-[44px_1fr_auto] items-center gap-x-3.5 gap-y-3 rounded-[14px] border-t px-3 py-3.5 transition-colors first:border-t-0 hover:border-transparent hover:bg-background md:grid-cols-[44px_1.5fr_1.25fr_130px_286px] [&:hover+li]:border-transparent",
        closed && "opacity-60 hover:opacity-100"
      )}
    >
      <span className={cn("flex size-11 items-center justify-center rounded-xl text-sm font-bold", tintAt(hash))}>
        {initials(company)}
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{offer?.title ?? "Job offer"}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${offer?.title ?? "job"} posting`}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.25" />
            </a>
          )}
        </div>
        <p className="truncate text-[0.8125rem] text-muted-foreground">
          {company}
          {offer?.location ? ` · ${offer.location}` : ""}
        </p>
        {application.followUpNotes && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <NotebookPen className="mt-px size-3.25 shrink-0" />
            <span className="line-clamp-1">{application.followUpNotes}</span>
          </p>
        )}
      </div>

      <div className="col-span-3 font-mono md:col-span-1">
        <p className="text-[0.8125rem] font-medium">Applied {shortDate(application.applicationDate)}</p>
        <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
          {daysAgo(application.applicationDate)} · last follow-up{" "}
          {shortAgo(application.lastFollowUpAt ?? application.applicationDate)}
        </p>
        {application.dueForFollowUp && (
          <p className="mt-1 flex items-center gap-1.25 text-[0.6875rem] font-medium text-warning-strong">
            <BellRing className="size-3" />
            Follow up due
          </p>
        )}
      </div>

      <div className="col-span-3 md:col-span-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Status: ${APPLICATION_STATUS[status].label}. Change status`}
            className={cn(
              badgeVariants({ variant: APPLICATION_STATUS[status].variant }),
              "h-7 cursor-pointer pr-2 outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            )}
          >
            {APPLICATION_STATUS[status].label}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {(Object.keys(APPLICATION_STATUS) as ApplicationStatus[]).map((value) => (
              <DropdownMenuItem key={value} onClick={() => value !== status && onStatus(value)}>
                <span className={cn("size-2 rounded-full", APPLICATION_STATUS[value].dot)} />
                {APPLICATION_STATUS[value].label}
                {value === status && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="col-span-3 flex items-center justify-end gap-1.5 md:col-span-1">
        {!closed && <DraftButton subject={{ kind: "application", application }} due={application.dueForFollowUp} />}
        {!closed && (
          <Button
            size="sm"
            variant="outline"
            onClick={onFollowedUp}
            disabled={followingUp}
            className={cn(
              "cursor-pointer",
              application.dueForFollowUp &&
                "border-primary/50 bg-primary/12 text-warning-strong shadow-none hover:bg-primary/20"
            )}
          >
            <Check />
            Followed up
          </Button>
        )}
        <Button size="icon-sm" variant="ghost" aria-label="Edit application" onClick={onEdit} className={iconButtonClass}>
          <Pencil className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Delete application" onClick={onDelete} className={iconButtonClass}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
