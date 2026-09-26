"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/components/ai/Toast";
import { FollowUpWriter, type DraftSubject } from "@/components/ai/FollowUpWriter";

/** "Draft" button that opens the AI follow-up writer for an application or a recruiter. */
export function DraftButton({ subject, due, className }: { subject: DraftSubject; due?: boolean; className?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const name = subject.kind === "application" ? subject.application.jobOffer?.company ?? "application" : subject.recruiter.name;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: subject.kind === "application" ? queryKeys.jobApplications : queryKeys.recruiterContacts });
    queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`Draft a follow-up for ${name}`}
        className={cn("cursor-pointer", due && "border-ring ring-3 ring-primary/20", className)}
      >
        <Sparkles className="text-ring" />
        Draft
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[640px]">
          <FollowUpWriter
            subject={subject}
            onClose={() => setOpen(false)}
            onMarked={(marked) => {
              setOpen(false);
              refresh();
              showToast({
                title: marked.title,
                onUndo: async () => {
                  await marked.undo();
                  refresh();
                },
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
