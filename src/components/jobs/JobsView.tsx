"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Briefcase, Check, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { JobApplication, RecruiterContact } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteDialog, EmptyState, FormDialog } from "@/components/ui-patterns/dialogs";
import { AddApplicationForm, EditApplicationForm } from "@/components/forms/ApplicationForms";
import { RecruiterContactForm } from "@/components/forms/RecruiterContactForm";
import { ApplicationRow } from "@/components/jobs/ApplicationRow";
import { RecruiterCard } from "@/components/jobs/RecruiterCard";
import { EndConversationDialog, endSnapshot, reopenContact, restoreContact } from "@/components/jobs/EndConversationDialog";
import { showToast } from "@/components/ai/Toast";
import { applicationStatus, isClosed, shortDate, type ApplicationStatus } from "@/components/jobs/job-utils";

type Tab = "applications" | "recruiters";
type Filter = "all" | "open" | "closed";
type ContactFilter = "all" | "open" | "ended";

type Deleting =
  | { kind: "application"; id: string; name: string }
  | { kind: "recruiter"; id: string; name: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return res.json();
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

function StatCard({
  label,
  dot,
  value,
  sub,
  highlight,
}: {
  label: string;
  dot: string;
  value: number;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "gap-1.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]",
        highlight && "border-primary/40 bg-primary/5"
      )}
    >
      <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot)} />
        {label}
      </p>
      <p className={cn("font-mono text-[1.625rem] font-medium", highlight && value > 0 && "text-warning-strong")}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

export function JobsView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("applications");
  const [filter, setFilter] = useState<Filter>("all");
  const [appDialog, setAppDialog] = useState<"add" | JobApplication | null>(null);
  const [recruiterDialog, setRecruiterDialog] = useState<"add" | RecruiterContact | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [contactFilter, setContactFilter] = useState<ContactFilter>("open");
  const [ending, setEnding] = useState<RecruiterContact | null>(null);

  const applicationsQuery = useQuery({
    queryKey: queryKeys.jobApplications,
    queryFn: () => getJson<JobApplication[]>("/api/job-applications"),
  });
  const contactsQuery = useQuery({
    queryKey: queryKeys.recruiterContacts,
    queryFn: () => getJson<RecruiterContact[]>("/api/recruiter-contacts"),
  });

  const refresh = (key: readonly string[]) => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: queryKeys.notificationsSummary });
  };

  const appMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: ApplicationStatus; markFollowedUp?: boolean } }) =>
      send(`/api/job-applications/${id}`, "PATCH", body),
    onSettled: () => refresh(queryKeys.jobApplications),
  });

  const contactedMutation = useMutation({
    mutationFn: (id: string) => send(`/api/recruiter-contacts/${id}`, "PATCH", { markContacted: true }),
    onSettled: () => refresh(queryKeys.recruiterContacts),
  });

  const reopenMutation = useMutation({
    mutationFn: (contact: RecruiterContact) => reopenContact(contact.id),
    onSuccess: (_data, contact) => {
      const next = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      showToast({
        title: "Reopened",
        detail: `· next follow-up ${next}`,
        onUndo: async () => {
          await restoreContact(contact.id, endSnapshot(contact));
          refresh(queryKeys.recruiterContacts);
        },
      });
    },
    onSettled: () => refresh(queryKeys.recruiterContacts),
  });

  const deleteMutation = useMutation({
    mutationFn: (target: Deleting) =>
      send(
        target.kind === "application" ? `/api/job-applications/${target.id}` : `/api/recruiter-contacts/${target.id}`,
        "DELETE"
      ),
    onSuccess: (_data, target) => {
      setDeleting(null);
      refresh(target.kind === "application" ? queryKeys.jobApplications : queryKeys.recruiterContacts);
    },
  });

  const applications = applicationsQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const dueApps = applications.filter((a) => a.dueForFollowUp);
  const dueContacts = contacts.filter((c) => c.dueForFollowUp);
  const openContacts = contacts.filter((c) => !c.endedAt);
  const endedCount = contacts.length - openContacts.length;
  const visibleContacts = contacts.filter((c) =>
    contactFilter === "all" ? true : contactFilter === "open" ? !c.endedAt : !!c.endedAt
  );
  const appliedCount = applications.filter((a) => applicationStatus(a) === "applied").length;
  const interviewingCount = applications.filter((a) => applicationStatus(a) === "interviewing").length;

  const visibleApps = applications.filter((a) =>
    filter === "all" ? true : filter === "open" ? !isClosed(a) : isClosed(a)
  );

  const editingApp = appDialog && appDialog !== "add" ? appDialog : undefined;
  const editingContact = recruiterDialog && recruiterDialog !== "add" ? recruiterDialog : undefined;
  const loading = applicationsQuery.isPending || contactsQuery.isPending;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track your applications and recruiter follow-ups.</p>
        </div>
        <Button
          onClick={() => (tab === "applications" ? setAppDialog("add") : setRecruiterDialog("add"))}
          className="cursor-pointer"
        >
          <Plus />
          {tab === "applications" ? "Add application" : "Add recruiter"}
        </Button>
      </div>

      <div className="mt-5.5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Applied" dot="bg-primary" value={appliedCount} sub="waiting on a reply" />
        <StatCard label="Interviewing" dot="bg-special" value={interviewingCount} sub="in process" />
        <StatCard
          label="Follow-ups due"
          dot="bg-warning-strong"
          value={dueApps.length + dueContacts.length}
          sub="every 3 days since last contact"
          highlight
        />
        <StatCard
          label="Recruiters"
          dot="bg-info"
          value={openContacts.length}
          sub={
            endedCount > 0
              ? `${openContacts.length} open · ${endedCount} ended`
              : dueContacts.length > 0
                ? `${dueContacts.length} to follow up`
                : "all caught up"
          }
        />
      </div>

      {dueApps.length + dueContacts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3.5">
          <p className="flex items-center gap-2.5 text-sm font-semibold text-warning-strong">
            <BellRing className="size-4.25" />
            {dueApps.length + dueContacts.length} follow-up{dueApps.length + dueContacts.length === 1 ? "" : "s"} due today
          </p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {dueApps.map((a) => (
              <DueChip
                key={a.id}
                title={a.jobOffer?.company ?? "Company"}
                sub={a.jobOffer?.title ?? "Application"}
                disabled={appMutation.isPending}
                onDone={() => appMutation.mutate({ id: a.id, body: { markFollowedUp: true } })}
              />
            ))}
            {dueContacts.map((c) => (
              <DueChip
                key={c.id}
                title={c.name}
                sub={c.company ? `Recruiter · ${c.company}` : "Recruiter"}
                disabled={contactedMutation.isPending}
                onDone={() => contactedMutation.mutate(c.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="applications" className="cursor-pointer">
              Applications
              <span className="font-mono text-[0.6875rem] text-muted-foreground">{applications.length}</span>
              {dueApps.length > 0 && <DuePill count={dueApps.length} />}
            </TabsTrigger>
            <TabsTrigger value="recruiters" className="cursor-pointer">
              Recruiters
              <span className="font-mono text-[0.6875rem] text-muted-foreground">{contacts.length}</span>
              {dueContacts.length > 0 && <DuePill count={dueContacts.length} />}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "recruiters" && contacts.length > 0 && (
          <div role="radiogroup" aria-label="Filter recruiters" className="flex gap-1.5">
            {(["all", "open", "ended"] as ContactFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={contactFilter === f}
                onClick={() => setContactFilter(f)}
                className={cn(
                  "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-card px-3 text-[0.8125rem] text-muted-foreground capitalize outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
                  contactFilter === f && "border-foreground font-medium text-foreground"
                )}
              >
                {f}
                {f === "ended" && endedCount > 0 && (
                  <span className="font-mono text-[0.6875rem] font-normal text-muted-foreground">{endedCount}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {tab === "applications" && (
          <div role="radiogroup" aria-label="Filter applications" className="flex gap-1.5">
            {(["all", "open", "closed"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-7.5 cursor-pointer rounded-full border border-input bg-card px-3 text-[0.8125rem] text-muted-foreground capitalize outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
                  filter === f && "border-foreground font-medium text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <Skeleton className="mt-3.5 h-72 rounded-[20px]" />}
      {(applicationsQuery.isError || contactsQuery.isError) && (
        <p className="mt-3.5 text-sm text-destructive-strong">Failed to load your follow-ups.</p>
      )}

      {!loading && tab === "applications" && (
        <Card className="mt-3.5 gap-0 rounded-[20px] px-2 [--card-spacing:--spacing(1.5)]">
          {applications.length === 0 ? (
            <div className="p-3">
              <EmptyState
                icon={Briefcase}
                title="No applications yet"
                description="Log the jobs you apply to and get a reminder to follow up every 3 days."
                actionLabel="Add application"
                primary
                onAction={() => setAppDialog("add")}
              />
            </div>
          ) : visibleApps.length === 0 ? (
            <p className="px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">No {filter} applications.</p>
          ) : (
            <ul>
              {visibleApps.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  followingUp={appMutation.isPending}
                  onStatus={(status) => appMutation.mutate({ id: application.id, body: { status } })}
                  onFollowedUp={() => appMutation.mutate({ id: application.id, body: { markFollowedUp: true } })}
                  onEdit={() => setAppDialog(application)}
                  onDelete={() =>
                    setDeleting({
                      kind: "application",
                      id: application.id,
                      name: application.jobOffer?.title ?? "this application",
                    })
                  }
                />
              ))}
            </ul>
          )}
        </Card>
      )}

      {!loading && tab === "recruiters" && (
        <div className="mt-3.5">
          {contacts.length === 0 ? (
            <Card className="rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
              <EmptyState
                icon={Users}
                title="No recruiters yet"
                description="Keep track of the recruiters you message and when to follow up."
                actionLabel="Add recruiter"
                primary
                onAction={() => setRecruiterDialog("add")}
              />
            </Card>
          ) : visibleContacts.length === 0 ? (
            <Card className="rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
              <p className="py-6 text-center text-sm text-muted-foreground">
                {contactFilter === "ended" ? "No ended conversations." : "No open conversations. Everything is wrapped up."}
              </p>
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleContacts.map((contact) => (
                <RecruiterCard
                  key={contact.id}
                  contact={contact}
                  pending={contactedMutation.isPending || reopenMutation.isPending}
                  onContacted={() => contactedMutation.mutate(contact.id)}
                  onEdit={() => setRecruiterDialog(contact)}
                  onDelete={() => setDeleting({ kind: "recruiter", id: contact.id, name: contact.name })}
                  onEnd={() => setEnding(contact)}
                  onReopen={() => reopenMutation.mutate(contact)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <FormDialog
        open={appDialog !== null}
        onOpenChange={(open) => !open && setAppDialog(null)}
        title={editingApp ? editingApp.jobOffer?.title ?? "Edit application" : "Add application"}
        description={
          editingApp
            ? `${editingApp.jobOffer?.company ?? ""} · applied ${shortDate(editingApp.applicationDate)}`
            : "You'll get a follow-up reminder every 3 days."
        }
      >
        {appDialog === "add" && <AddApplicationForm onDone={() => setAppDialog(null)} />}
        {editingApp && (
          <EditApplicationForm key={editingApp.id} application={editingApp} onDone={() => setAppDialog(null)} />
        )}
      </FormDialog>

      <FormDialog
        open={recruiterDialog !== null}
        onOpenChange={(open) => !open && setRecruiterDialog(null)}
        title={editingContact ? "Edit recruiter" : "Add recruiter"}
        description="Someone you message about a role."
      >
        {recruiterDialog !== null && (
          <RecruiterContactForm
            key={editingContact?.id ?? "new"}
            contact={editingContact}
            onDone={() => setRecruiterDialog(null)}
          />
        )}
      </FormDialog>

      <EndConversationDialog
        contact={ending}
        onClose={() => setEnding(null)}
        onEnded={(contact) => {
          refresh(queryKeys.recruiterContacts);
          queryClient.invalidateQueries({ queryKey: queryKeys.jobApplications });
          showToast({
            title: "Conversation ended",
            detail: `· ${contact.name}`,
            onUndo: async () => {
              await restoreContact(contact.id, endSnapshot(contact));
              refresh(queryKeys.recruiterContacts);
            },
          });
        }}
      />

      <DeleteDialog
        name={deleting?.name ?? ""}
        open={deleting !== null}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setDeleting(null);
          deleteMutation.reset();
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}

function DuePill({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-primary/18 px-1.75 py-px font-mono text-[0.65625rem] font-medium text-warning-strong">
      {count} due
    </span>
  );
}

function DueChip({
  title,
  sub,
  disabled,
  onDone,
}: {
  title: string;
  sub: string;
  disabled: boolean;
  onDone: () => void;
}) {
  return (
    <li className="inline-flex h-8 items-center gap-2 rounded-full border border-primary/30 bg-card py-0 pr-1.5 pl-3 text-[0.8125rem]">
      <span className="font-medium">{title}</span>
      <span className="text-muted-foreground">{sub}</span>
      <button
        type="button"
        onClick={onDone}
        disabled={disabled}
        aria-label={`Mark ${title} as followed up`}
        className="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-full bg-primary/15 px-2 text-[0.6875rem] font-medium text-warning-strong outline-none transition-colors hover:bg-primary/25 focus-visible:ring-4 focus-visible:ring-ring/20 disabled:opacity-50"
      >
        <Check className="size-2.75" />
        Done
      </button>
    </li>
  );
}
