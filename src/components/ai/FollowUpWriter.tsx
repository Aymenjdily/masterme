"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Link2,
  Mail,
  NotebookPen,
  PenLine,
  RefreshCw,
  Route,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobApplication, RecruiterContact } from "@/types";
import {
  ACTION_LABEL,
  FOLLOW_UP_ACTIONS,
  LINKEDIN_MAX_CHARS,
  type FollowUpAction,
  type FollowUpChannel,
  type FollowUpLanguage,
  type FollowUpResult,
  type FollowUpTone,
} from "@/lib/ai/follow-up-kinds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { ConfidenceMeter, percent } from "@/components/ai/ConfidenceMeter";
import { recordOutcome } from "@/components/ai/PasteAnything";
import { APPLICATION_STATUS, applicationStatus, shortAgo, shortDate } from "@/components/jobs/job-utils";

export type DraftSubject =
  | { kind: "application"; application: JobApplication }
  | { kind: "recruiter"; recruiter: RecruiterContact };

/** What the toast needs after "Copy & mark". */
export type FollowUpMarked = { title: string; undo: () => Promise<void> };

type Choices = { action?: FollowUpAction; language?: FollowUpLanguage; tone?: FollowUpTone };
type RunOptions = Choices & { channel: FollowUpChannel; force?: boolean; shorter?: boolean; previous?: string };

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Clipboard API first; falls back to a hidden textarea where the API is blocked. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    if (!ok) throw new Error("Copy failed");
  }
}

class ApiError extends Error {}

function subjectInfo(subject: DraftSubject) {
  if (subject.kind === "application") {
    const a = subject.application;
    return {
      target: "application" as const,
      id: a.id,
      title: `${a.jobOffer?.title ?? "Application"} · ${a.jobOffer?.company ?? "Company"}`,
      email: a.jobOffer?.recruiterEmail || null,
      linkedinUrl: null as string | null,
      defaultChannel: "email" as FollowUpChannel,
      markLabel: "Copy & mark followed up",
      markedLabel: "marked followed up",
      patchUrl: `/api/job-applications/${a.id}`,
      mark: { markFollowedUp: true },
      restore: { restoreFollowUpAt: a.lastFollowUpAt ?? null },
    };
  }
  const c = subject.recruiter;
  return {
    target: "recruiter" as const,
    id: c.id,
    title: `${c.name}${c.company ? ` · ${c.company}` : ""}`,
    email: c.email || null,
    linkedinUrl: c.linkedinUrl || null,
    defaultChannel: (!c.email && c.linkedinUrl ? "linkedin" : "email") as FollowUpChannel,
    markLabel: "Copy & mark contacted",
    markedLabel: "marked contacted",
    patchUrl: `/api/recruiter-contacts/${c.id}`,
    mark: { markContacted: true },
    restore: { restoreContactedAt: c.lastContactedAt ?? null },
  };
}

function Fact({ icon: Icon, children, tone }: { icon?: typeof Clock; children: ReactNode; tone?: string }) {
  return (
    <span className={cn("inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 font-mono text-[0.6875rem]", tone)}>
      {Icon && <Icon className="size-3 shrink-0 opacity-70" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Facts({ subject }: { subject: DraftSubject }) {
  if (subject.kind === "application") {
    const a = subject.application;
    const status = APPLICATION_STATUS[applicationStatus(a)];
    return (
      <div className="flex flex-wrap gap-1.5">
        <Fact icon={CalendarDays}>
          Applied {shortDate(a.applicationDate)} · {shortAgo(a.applicationDate)}
        </Fact>
        <Fact icon={BellRing} tone={a.dueForFollowUp ? "bg-primary/15 text-warning-strong" : undefined}>
          Last follow-up {shortAgo(a.lastFollowUpAt ?? a.applicationDate)}
        </Fact>
        <Fact tone={status.variant === "special" ? "bg-special/12 text-special-strong" : "bg-primary/15 text-warning-strong"}>{status.label}</Fact>
        {a.followUpNotes && <Fact icon={NotebookPen}>{a.followUpNotes}</Fact>}
      </div>
    );
  }
  const c = subject.recruiter;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Fact icon={BellRing} tone={c.dueForFollowUp ? "bg-primary/15 text-warning-strong" : undefined}>
        {c.lastContactedAt ? `Last contact ${shortAgo(c.lastContactedAt)}` : "Not contacted yet"}
      </Fact>
      {c.notes && <Fact icon={NotebookPen}>{c.notes}</Fact>}
    </div>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-start gap-3 px-5.5 pt-5 pr-14">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-ring">
        <Sparkles className="size-4.5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-[1.0625rem] leading-tight font-semibold">Follow-up draft</h2>
        <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">{title}</p>
      </div>
    </div>
  );
}

function Footer({ meta, children }: { meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4.5 flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-5.5 py-3.5">
      <span className="mr-auto flex items-center gap-1.5 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">{meta}</span>
      {children}
    </div>
  );
}

function aiTag(probs: Record<string, number> | undefined, value: string, label: string) {
  if (!probs || probs[value] === undefined) return null;
  return (
    <em className="ml-auto font-mono text-[0.65625rem] font-medium text-warning-strong not-italic">
      {label} {percent(probs[value])}
    </em>
  );
}

export function FollowUpWriter({
  subject,
  onClose,
  onMarked,
}: {
  subject: DraftSubject;
  onClose: () => void;
  onMarked: (marked: FollowUpMarked) => void;
}) {
  const info = subjectInfo(subject);
  const [status, setStatus] = useState<"loading" | "wait" | "draft" | "error">("loading");
  const [rewriting, setRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FollowUpResult | null>(null);
  const [channel, setChannel] = useState<FollowUpChannel>(info.defaultChannel);
  const [choices, setChoices] = useState<Required<Choices> | null>(null);
  // The AI's first picks and their probabilities, kept while the user changes things.
  const [aiPick, setAiPick] = useState<{ choices: Required<Choices>; probs: FollowUpResult["probabilities"] } | null>(null);
  const [subjectLine, setSubjectLine] = useState("");
  const [body, setBody] = useState("");
  const [aiDraft, setAiDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);

  const mounted = useRef(true);
  const started = useRef(false);
  const lastRun = useRef<RunOptions>({ channel: info.defaultChannel });
  const pending = useRef(new Set<string>());
  const draftEvent = useRef<string | null>(null);

  function settle(id: string | null | undefined, outcome: "accepted" | "edited" | "rejected") {
    if (!id || !pending.current.has(id)) return;
    pending.current.delete(id);
    recordOutcome(id, outcome);
  }

  async function run(options: RunOptions) {
    lastRun.current = options;
    setError(null);
    try {
      const res = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: info.target, id: info.id, ...options }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(typeof data?.error === "string" ? data.error : "Something went wrong.");
      const next = data as FollowUpResult;

      if (!mounted.current) {
        recordOutcome(next.decisionEventId, "rejected");
        recordOutcome(next.draftEventId, "rejected");
        return;
      }
      for (const id of [next.decisionEventId, next.draftEventId]) if (id) pending.current.add(id);
      // A new draft replaces the old one: the old one wasn't used.
      if (next.draftEventId) {
        settle(draftEvent.current, "rejected");
        draftEvent.current = next.draftEventId;
      }

      const picked = { action: next.action, language: next.language, tone: next.tone };
      setAiPick((prev) => prev ?? { choices: picked, probs: next.probabilities });
      setChoices(picked);
      setChannel(next.channel);
      setResult(next);
      if (next.wait) {
        setStatus("wait");
      } else if (next.draft) {
        setSubjectLine(next.draft.subject ?? "");
        setBody(next.draft.body);
        setAiDraft({ subject: next.draft.subject ?? "", body: next.draft.body });
        setStatus("draft");
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof ApiError ? err.message : "The AI didn't answer in time.");
      setStatus("error");
    } finally {
      if (mounted.current) setRewriting(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    const events = pending.current;
    if (!started.current) {
      started.current = true;
      void run({ channel: info.defaultChannel });
    }
    return () => {
      mounted.current = false;
      for (const id of events) recordOutcome(id, "rejected");
      events.clear();
    };
    // Runs once per open dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redo(change: Partial<RunOptions>) {
    if (!choices) return;
    setRewriting(true);
    void run({ ...choices, channel, force: true, ...change });
  }

  const edited = !!aiDraft && (aiDraft.subject !== subjectLine || aiDraft.body !== body);

  function recordUse() {
    const kept =
      !!aiPick && !!choices && (["action", "language", "tone"] as const).every((k) => aiPick.choices[k] === choices[k]);
    settle(result?.decisionEventId, kept ? "accepted" : "edited");
    // Decisions made in later calls (after a change) count the same way.
    for (const id of [...pending.current]) if (id !== draftEvent.current) settle(id, kept ? "accepted" : "edited");
    settle(draftEvent.current, edited ? "edited" : "accepted");
  }

  async function copy() {
    try {
      await copyText(body);
    } catch {
      setError("Couldn't copy. Select the text and copy it yourself.");
      return;
    }
    recordUse();
    setCopied(true);
    setTimeout(() => mounted.current && setCopied(false), 1800);
  }

  async function copyAndMark() {
    setMarking(true);
    try {
      await copyText(body);
      const res = await fetch(info.patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info.mark),
      });
      if (!res.ok) throw new Error("Failed to mark");
      recordUse();
      const eventIds = [result?.decisionEventId, draftEvent.current].filter((id): id is string => !!id);
      onMarked({
        title: `Copied and ${info.markedLabel}`,
        undo: async () => {
          const undoRes = await fetch(info.patchUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(info.restore),
          });
          if (!undoRes.ok) throw new Error("Undo failed");
          for (const id of eventIds) recordOutcome(id, "rejected");
        },
      });
    } catch {
      setError("Couldn't mark it. Your draft is still here.");
    } finally {
      setMarking(false);
    }
  }

  function openInEmail() {
    if (!info.email) return;
    recordUse();
    const params = new URLSearchParams({ subject: subjectLine, body });
    window.location.href = `mailto:${info.email}?${params.toString().replace(/\+/g, "%20")}`;
  }

  const probs = aiPick?.probs;
  const bestNonWait =
    (probs?.action &&
      [...FOLLOW_UP_ACTIONS].filter((a) => a !== "wait").sort((a, b) => (probs.action![b] ?? 0) - (probs.action![a] ?? 0))[0]) ||
    "check_in";

  /* ---------- loading ---------- */
  if (status === "loading") {
    return (
      <>
        <Header title={info.title} />
        <div className="px-5.5 pt-4">
          <Facts subject={subject} />
          <div className="mt-4 flex flex-col gap-2.5 text-[0.8125rem]">
            <p className="flex items-center gap-2.5">
              <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />
              Deciding what to say, the language and the tone
            </p>
            <p className="flex items-center gap-2.5 text-muted-foreground">
              <span className="size-5 rounded-full border-[1.5px] border-input" />
              Writing the message
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2.5 rounded-[14px] border bg-primary/5 p-3.5">
            {[92, 100, 78, 40].map((w) => (
              <div key={w} className="h-3 animate-pulse rounded-md bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <Footer meta="Cancel stops the request">
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button disabled>Copy</Button>
        </Footer>
      </>
    );
  }

  /* ---------- error ---------- */
  if (status === "error") {
    return (
      <>
        <Header title={info.title} />
        <div className="px-5.5 pt-4">
          <p className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-destructive-strong">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error} Try again, or write it yourself in your email app.</span>
          </p>
        </div>
        <Footer>
          <Button variant="ghost" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            onClick={() => {
              setStatus("loading");
              void run(lastRun.current);
            }}
            className="cursor-pointer"
          >
            Try again
          </Button>
        </Footer>
      </>
    );
  }

  /* ---------- wait ---------- */
  if (status === "wait" && result?.wait) {
    return (
      <>
        <Header title={info.title} />
        <div className="px-5.5 pt-4">
          <Facts subject={subject} />
          <div className="mt-3 flex gap-3 rounded-[14px] border border-primary/35 bg-primary/8 p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-primary/35 bg-card text-ring">
              <Clock className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{result.wait.title}</p>
              <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{result.wait.text}</p>
            </div>
            <span className="shrink-0 font-mono text-xs font-medium text-warning-strong">wait · {percent(result.wait.probability)}</span>
          </div>
        </div>
        <Footer
          meta={
            <>
              <i className="block size-1.5 rounded-full bg-primary" />
              {result.aiCalls} AI call{result.aiCalls === 1 ? "" : "s"} · {seconds(result.ms)}
            </>
          }
        >
          <Button
            variant="ghost"
            disabled={rewriting}
            onClick={() => {
              setStatus("loading");
              void run({ ...choices, action: bestNonWait, channel, force: true });
            }}
            className="cursor-pointer"
          >
            Write anyway
          </Button>
          <Button
            onClick={() => {
              settle(result.decisionEventId, "accepted");
              onClose();
            }}
            className="cursor-pointer"
          >
            OK, later
          </Button>
        </Footer>
      </>
    );
  }

  if (!result || !choices) return null;

  /* ---------- draft ---------- */
  const aiChoseAction = aiPick?.choices.action === choices.action && !!probs?.action;
  const overLimit = channel === "linkedin" && body.length > LINKEDIN_MAX_CHARS;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <>
      <Header title={info.title} />
      <div className="px-5.5 pt-4">
        <Facts subject={subject} />

        <div className="mt-3 flex items-center gap-3 rounded-[14px] border px-3.5 py-3">
          <span className="flex size-9.5 shrink-0 items-center justify-center rounded-[11px] bg-primary/15 text-ring">
            <Route className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.6875rem] text-muted-foreground">{aiChoseAction ? "AI suggests" : "You picked"}</p>
            <p className="text-sm font-semibold">
              {ACTION_LABEL[choices.action]}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={rewriting}
                  className="ml-2.5 inline-flex cursor-pointer items-center gap-0.5 text-xs font-medium text-info-strong outline-none hover:underline focus-visible:underline"
                >
                  Change
                  <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-88">
                  <DropdownMenuLabel className="font-mono text-[0.625rem] tracking-widest text-muted-foreground uppercase">
                    What to say
                  </DropdownMenuLabel>
                  {FOLLOW_UP_ACTIONS.map((action) => {
                    const p = probs?.action?.[action];
                    const on = action === choices.action;
                    return (
                      <DropdownMenuItem
                        key={action}
                        onClick={() => {
                          if (on) return;
                          if (action === "wait") {
                            setStatus("loading");
                            void run({ ...choices, action, channel });
                          } else redo({ action, previous: undefined });
                        }}
                        className={cn(on && "bg-accent font-semibold")}
                      >
                        <span className="flex-1 whitespace-nowrap">{ACTION_LABEL[action]}</span>
                        {p !== undefined && (
                          <>
                            <span className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: percent(p) }} />
                            </span>
                            <span className={cn("w-8 text-right font-mono text-[0.6875rem]", on ? "text-warning-strong" : "text-muted-foreground")}>
                              {percent(p)}
                            </span>
                          </>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </p>
          </div>
          {aiChoseAction && probs?.action && <ConfidenceMeter value={probs.action[choices.action]} />}
        </div>

        <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1.2fr_1fr]">
          <div>
            <p className="mb-1.5 text-xs font-medium">Channel</p>
            <SegmentedControl
              label="Channel"
              value={channel}
              onChange={(value) => value !== channel && redo({ channel: value, previous: undefined })}
              options={[
                { value: "email", label: "Email" },
                { value: "linkedin", label: "LinkedIn" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              {aiPick?.choices.language === choices.language && probs?.language && <i className="block size-1.5 rounded-full bg-primary" />}
              Language
              {aiPick?.choices.language === choices.language && aiTag(probs?.language, choices.language, choices.language.toUpperCase())}
            </p>
            <SegmentedControl
              label="Language"
              value={choices.language}
              onChange={(value) => value !== choices.language && redo({ language: value, previous: undefined })}
              options={[
                { value: "en", label: "English" },
                { value: "fr", label: "Français" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              {aiPick?.choices.tone === choices.tone && probs?.tone && <i className="block size-1.5 rounded-full bg-primary" />}
              Tone
              {aiPick?.choices.tone === choices.tone && aiTag(probs?.tone, choices.tone, "")}
            </p>
            <SegmentedControl
              label="Tone"
              value={choices.tone}
              onChange={(value) => value !== choices.tone && redo({ tone: value, previous: undefined })}
              options={[
                { value: "friendly", label: "Friendly" },
                { value: "formal", label: "Formal" },
              ]}
            />
          </div>
        </div>

        <div className={cn("relative mt-3.5 overflow-hidden rounded-[14px] border border-input", rewriting && "pointer-events-none")}>
          {channel === "email" && (
            <div className="flex items-center gap-2.5 border-b px-3.5 py-1.5">
              <label htmlFor="fu-subject" className="w-13 shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
                Subject
              </label>
              <Input
                id="fu-subject"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
                className={cn("h-8 border-0 px-0 text-[0.8125rem] shadow-none focus-visible:ring-0", subjectLine === aiDraft?.subject && "bg-transparent")}
              />
            </div>
          )}
          <Textarea
            aria-label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={cn(
              "field-sizing-content max-h-[45vh] min-h-40 resize-none rounded-none border-0 px-3.5 py-3 text-[0.8125rem] leading-relaxed shadow-none focus-visible:ring-0",
              body === aiDraft?.body ? "bg-primary/5" : "bg-card",
              channel === "linkedin" && "min-h-24"
            )}
          />
          <div className="flex items-center gap-2 border-t bg-card py-2 pr-2.5 pl-3.5">
            <span className="mr-auto font-mono text-[0.6875rem] text-muted-foreground">
              {channel === "linkedin" ? (
                <>
                  <b className={cn("font-medium", overLimit ? "text-destructive-strong" : "text-success-strong")}>
                    {body.length} / {LINKEDIN_MAX_CHARS}
                  </b>{" "}
                  characters
                </>
              ) : (
                <>
                  <b className="font-medium text-success-strong">{words} words</b>
                  {words > 150 ? " · a bit long for a follow-up" : " · email length is fine"}
                </>
              )}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => redo({ shorter: true, previous: body })} className="h-7 cursor-pointer px-2.5 text-xs">
              <PenLine className="size-3.25" />
              Shorter
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => redo({ previous: body })} className="h-7 cursor-pointer px-2.5 text-xs">
              <RefreshCw className="size-3.25" />
              Rewrite
            </Button>
          </div>
          {rewriting && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-[1px]">
              <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-card">
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />
                Writing…
              </span>
            </div>
          )}
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <i className="block size-1.5 rounded-full bg-primary" />
          Nothing is sent from MasterMe. Copy it, or open it in your {channel === "email" ? "email app" : "LinkedIn"}.
        </p>
        {error && <p className="mt-2 text-[0.8125rem] text-destructive-strong">{error}</p>}
      </div>

      <Footer
        meta={
          <>
            <i className="block size-1.5 rounded-full bg-success" />
            {result.aiCalls} AI call{result.aiCalls === 1 ? "" : "s"} · {seconds(result.ms)}
          </>
        }
      >
        {channel === "email" && info.email && (
          <Button variant="outline" onClick={openInEmail} disabled={rewriting} className="cursor-pointer">
            <Mail />
            Open in email
          </Button>
        )}
        {channel === "linkedin" && info.linkedinUrl && (
          <Button variant="outline" nativeButton={false} render={<a href={info.linkedinUrl} target="_blank" rel="noreferrer" />} className="cursor-pointer">
            <Link2 />
            Open profile
          </Button>
        )}
        <Button variant="outline" onClick={copy} disabled={rewriting || !body.trim()} className="cursor-pointer">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button onClick={copyAndMark} disabled={rewriting || marking || !body.trim()} className="cursor-pointer">
          <Check />
          {marking ? "Saving…" : info.markLabel}
        </Button>
      </Footer>
    </>
  );
}
