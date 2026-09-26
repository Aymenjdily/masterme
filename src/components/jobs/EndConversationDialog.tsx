"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleStop, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { END_REASONS, type EndReason } from "@/lib/validations";
import type { RecruiterContact } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/ui-patterns/dialogs";
import { AddApplicationForm } from "@/components/forms/ApplicationForms";
import { END_REASON_META } from "@/components/jobs/end-reasons";
import { shortAgo } from "@/components/jobs/job-utils";

async function patchContact(id: string, body: unknown) {
  const res = await fetch(`/api/recruiter-contacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update recruiter");
  return res.json();
}

/** The contact's values before a change, for Undo. */
export function endSnapshot(contact: RecruiterContact) {
  return {
    endedAt: contact.endedAt ?? null,
    endReason: contact.endReason ?? null,
    endNote: contact.endNote ?? null,
    lastContactedAt: contact.lastContactedAt ?? null,
  };
}

export function restoreContact(id: string, snapshot: ReturnType<typeof endSnapshot>) {
  return patchContact(id, { restoreEnd: snapshot });
}

export function reopenContact(id: string) {
  return patchContact(id, { reopen: true });
}

export function EndConversationDialog({
  contact,
  onClose,
  onEnded,
}: {
  contact: RecruiterContact | null;
  onClose: () => void;
  onEnded: (contact: RecruiterContact) => void;
}) {
  return (
    <FormDialog
      open={contact !== null}
      onOpenChange={(open) => !open && onClose()}
      title={contact ? `End conversation with ${contact.name}` : "End conversation"}
      description="Follow-up reminders stop. You can reopen it anytime."
      className="max-w-[560px]"
    >
      {contact && <EndForm key={contact.id} contact={contact} onClose={onClose} onEnded={onEnded} />}
    </FormDialog>
  );
}

function EndForm({
  contact,
  onClose,
  onEnded,
}: {
  contact: RecruiterContact;
  onClose: () => void;
  onEnded: (contact: RecruiterContact) => void;
}) {
  const [reason, setReason] = useState<EndReason | null>(null);
  const [note, setNote] = useState("");
  const [addApplication, setAddApplication] = useState(true);
  const [step, setStep] = useState<"reason" | "application">("reason");
  const saved = useRef(false);

  const end = useMutation({
    mutationFn: () => patchContact(contact.id, { end: { reason, note: note.trim() || undefined } }),
    onSuccess: () => {
      onEnded(contact);
      onClose();
    },
  });

  if (step === "application") {
    return (
      <>
        <p className="mx-6 mb-4 flex gap-2.5 rounded-xl bg-background px-3 py-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
          <NotebookPen className="mt-0.5 size-4 shrink-0" />
          Save the application, then the conversation with {contact.name} is ended.
        </p>
        <AddApplicationForm
          defaultCompany={contact.company ?? ""}
          onSaved={() => {
            saved.current = true;
            end.mutate();
          }}
          onDone={() => {
            if (!saved.current) setStep("reason");
          }}
        />
      </>
    );
  }

  const canApply = reason === "application" && !!contact.company;
  const goesToApplication = canApply && addApplication;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!reason) return;
        if (goesToApplication) setStep("application");
        else end.mutate();
      }}
    >
      <div className="px-6">
        <p className="mb-2 text-[0.8125rem] font-medium">What happened?</p>
        <div role="radiogroup" aria-label="What happened" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {END_REASONS.map((value) => {
            const meta = END_REASON_META[value];
            const on = reason === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(value)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card px-3 py-2.75 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/20",
                  on ? "border-ring bg-primary/5 ring-3 ring-primary/20" : "border-input hover:bg-background"
                )}
              >
                <span className={cn("flex size-7.5 shrink-0 items-center justify-center rounded-[9px]", meta.tone)}>
                  <meta.icon className="size-3.75" />
                </span>
                <span>
                  <span className="block text-[0.8125rem] font-semibold">{meta.label}</span>
                  <span className="mt-px block text-[0.71875rem] leading-snug text-muted-foreground">{meta.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        {canApply && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[0.8125rem]">
            <Checkbox checked={addApplication} onCheckedChange={(checked) => setAddApplication(!!checked)} />
            Also add an application at <b className="font-medium">{contact.company}</b>
          </label>
        )}

        <label htmlFor="end-note" className="mt-4 mb-2 flex text-[0.8125rem] font-medium">
          Note
          <span className="ml-auto text-xs font-normal text-muted-foreground">optional</span>
        </label>
        <Textarea
          id="end-note"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Salary too low, they'll keep my CV"
          className="min-h-16 text-[0.8125rem]"
        />
        {end.isError && <p className="mt-2 text-[0.8125rem] text-destructive-strong">Couldn&apos;t end it. Please try again.</p>}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
        <span className="mr-auto font-mono text-[0.6875rem] text-muted-foreground">
          {contact.lastContactedAt ? `Last contact ${shortAgo(contact.lastContactedAt)}` : "Not contacted yet"}
        </span>
        <Button type="button" variant="ghost" onClick={onClose} className="cursor-pointer">
          Cancel
        </Button>
        <Button type="submit" disabled={!reason || end.isPending} className="cursor-pointer">
          <CircleStop />
          {end.isPending ? "Ending…" : goesToApplication ? "Continue" : "End conversation"}
        </Button>
      </div>
    </form>
  );
}
