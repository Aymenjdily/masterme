"use client";

import { Check, CircleStop, Link2, Mail, MoreHorizontal, Pencil, Phone, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecruiterContact } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DraftButton } from "@/components/ai/DraftButton";
import { tintAt } from "@/components/portfolio/shared";
import { END_REASON_META } from "@/components/jobs/end-reasons";
import { initials, shortAgo, shortDate } from "@/components/jobs/job-utils";

const chipClass =
  "inline-flex h-7 items-center gap-1.25 rounded-lg bg-muted px-2.25 font-mono text-[0.6875rem] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/20 [&_svg]:size-3 [&_svg]:text-muted-foreground";

export function RecruiterCard({
  contact,
  onContacted,
  onEdit,
  onDelete,
  onEnd,
  onReopen,
  pending,
}: {
  contact: RecruiterContact;
  onContacted: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEnd: () => void;
  onReopen: () => void;
  pending: boolean;
}) {
  const ended = !!contact.endedAt;
  const due = !ended && !!contact.dueForFollowUp;
  const reason = contact.endReason ? END_REASON_META[contact.endReason] : null;
  const hash = [...contact.name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return (
    <li
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-4 shadow-card",
        due && "border-primary/40 bg-primary/5",
        ended && "bg-background/60 shadow-none"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10.5 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            tintAt(hash),
            ended && "opacity-70 grayscale"
          )}
        >
          {initials(contact.name)}
        </span>
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", ended && "text-muted-foreground")}>{contact.name}</p>
          {contact.company && <p className="truncate text-[0.8125rem] text-muted-foreground">{contact.company}</p>}
        </div>
      </div>

      {ended ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {reason && (
            <span className={cn("inline-flex h-5.5 w-max items-center gap-1.25 rounded-[7px] px-2 text-[0.6875rem] font-medium", reason.tone)}>
              <reason.icon className="size-3" />
              {reason.label}
            </span>
          )}
          {contact.endNote && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground italic">&ldquo;{contact.endNote}&rdquo;</p>
          )}
        </div>
      ) : (
        <>
          {(contact.email || contact.phone || contact.linkedinUrl) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className={chipClass} title={contact.email}>
                  <Mail />
                  Email
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className={chipClass} title={contact.phone}>
                  <Phone />
                  Call
                </a>
              )}
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className={chipClass}>
                  <Link2 />
                  LinkedIn
                </a>
              )}
            </div>
          )}
          {contact.notes && <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{contact.notes}</p>}
        </>
      )}

      <div aria-hidden className="min-h-3.5 flex-1" />
      <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
        <span
          className={cn(
            "mr-auto font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground",
            due && "font-medium text-warning-strong"
          )}
        >
          {ended
            ? `Ended ${shortDate(contact.endedAt!)}`
            : contact.lastContactedAt
              ? `Last contact ${shortAgo(contact.lastContactedAt)}${due ? " · due" : ""}`
              : "Not contacted yet"}
        </span>
        {ended ? (
          <Button size="sm" variant="outline" onClick={onReopen} disabled={pending} className="cursor-pointer">
            <Undo2 />
            Reopen
          </Button>
        ) : (
          <>
            <DraftButton subject={{ kind: "recruiter", recruiter: contact }} due={due} />
            <Button
              size="sm"
              variant="outline"
              onClick={onContacted}
              disabled={pending}
              className={cn(
                "cursor-pointer",
                due && "border-primary/50 bg-primary/12 text-warning-strong shadow-none hover:bg-primary/20"
              )}
            >
              <Check />
              Contacted
            </Button>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`More actions for ${contact.name}`}
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-input bg-card text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20 data-popup-open:border-foreground data-popup-open:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            {ended ? (
              <DropdownMenuItem onClick={onReopen}>
                <Undo2 />
                Reopen conversation
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onEnd}>
                <CircleStop />
                End conversation
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
