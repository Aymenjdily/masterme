"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { JobApplication } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { APPLICATION_STATUS, applicationStatus, type ApplicationStatus } from "@/components/jobs/job-utils";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

function useRefreshJobs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobApplications });
    queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
  };
}

function FormFooter({ pending, label, onCancel }: { pending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t px-6 py-4">
      <Button type="button" variant="ghost" onClick={onCancel} className="cursor-pointer">
        Cancel
      </Button>
      <Button type="submit" disabled={pending} className="cursor-pointer">
        {pending ? "Saving…" : label}
      </Button>
    </div>
  );
}

export function AddApplicationForm({
  onDone,
  defaultCompany = "",
  onSaved,
}: {
  onDone: () => void;
  defaultCompany?: string;
  /** Called only after a successful save (onDone is also used for Cancel) */
  onSaved?: () => void;
}) {
  const refresh = useRefreshJobs();
  const [company, setCompany] = useState(defaultCompany);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [appliedOn, setAppliedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [urlError, setUrlError] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      send("/api/job-applications", "POST", {
        company: company.trim(),
        title: title.trim(),
        url: url.trim() || undefined,
        appliedOn,
      }),
    onSuccess: () => {
      refresh();
      onSaved?.();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const bad = url.trim() !== "" && !/^https?:\/\/\S+$/.test(url.trim());
        setUrlError(bad);
        if (!bad) mutation.mutate();
      }}
      className="flex flex-col"
    >
      <FieldGroup className="grid grid-cols-1 gap-4.5 px-6 pb-6 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="app-company">Company</FieldLabel>
          <Input id="app-company" placeholder="OCP Group" autoFocus required value={company} onChange={(e) => setCompany(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="app-title">Job title</FieldLabel>
          <Input id="app-title" placeholder="Frontend Engineer" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="app-date">Applied on</FieldLabel>
          <Input id="app-date" type="date" className="font-mono" value={appliedOn} onChange={(e) => setAppliedOn(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="app-url">
            Job URL <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input id="app-url" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <FieldError errors={[urlError ? { message: "Enter a full link starting with https://" } : undefined]} />
        </Field>
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">Something went wrong. Please try again.</p>
      )}
      <FormFooter pending={mutation.isPending} label="Add application" onCancel={onDone} />
    </form>
  );
}

const STATUS_OPTIONS = (Object.keys(APPLICATION_STATUS) as ApplicationStatus[]).map((value) => ({
  value,
  label: APPLICATION_STATUS[value].label,
  dotClassName: APPLICATION_STATUS[value].dot,
}));

export function EditApplicationForm({
  application,
  onDone,
}: {
  application: JobApplication;
  onDone: () => void;
}) {
  const refresh = useRefreshJobs();
  const [status, setStatus] = useState<ApplicationStatus>(applicationStatus(application));
  const [notes, setNotes] = useState(application.followUpNotes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      send(`/api/job-applications/${application.id}`, "PATCH", { status, followUpNotes: notes }),
    onSuccess: () => {
      refresh();
      onDone();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col"
    >
      <FieldGroup className="gap-4.5 px-6 pb-6">
        <Field>
          <FieldLabel>Status</FieldLabel>
          <SegmentedControl label="Application status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </Field>
        <Field>
          <FieldLabel htmlFor="app-notes">Follow-up notes</FieldLabel>
          <Textarea
            id="app-notes"
            autoFocus
            placeholder="Who you talked to, what's next…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </FieldGroup>
      {mutation.isError && (
        <p className="px-6 pb-4 text-sm text-destructive-strong">Something went wrong. Please try again.</p>
      )}
      <FormFooter pending={mutation.isPending} label="Save" onCancel={onDone} />
    </form>
  );
}
