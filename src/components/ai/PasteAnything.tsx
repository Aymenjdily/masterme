"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Info, Quote, Sparkles, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { PASTE_KINDS, type ClassifyResult, type ExtractResult, type PasteKind } from "@/lib/ai/paste-kinds";
import type { LearningPath } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { selectClassName } from "@/components/forms/MonthlyCostForm";
import { ConfidenceMeter, percent } from "@/components/ai/ConfidenceMeter";
import {
  KIND_FIELDS,
  KIND_META,
  KIND_VALIDATION,
  SAVE_LABEL,
  normalizeUrl,
  todayIso,
  type FieldDef,
} from "@/components/ai/paste-meta";

const MAX_CHARS = 4000;

type Step = "input" | "classifying" | "pick" | "ask" | "extracting" | "review" | "error";
type Values = Record<string, string>;

/** What the toast needs to show the result and undo it. */
export type PasteSaved = {
  title: string;
  detail?: string;
  href: string;
  hrefLabel: string;
  /** DELETE urls, in the order they should be undone */
  undo: string[];
  eventIds: string[];
};

class ApiError extends Error {}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.";
    throw new ApiError(message);
  }
  return data as T;
}

export function recordOutcome(eventId: string | null | undefined, outcome: "accepted" | "edited" | "rejected") {
  if (!eventId) return;
  void fetch(`/api/ai/events/${eventId}/outcome`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outcome }),
    keepalive: true,
  }).catch(() => {});
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const optional = (value: string | undefined) => value?.trim() || undefined;

function followUpLabel() {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** The pasted text, clamped to two lines, with the values the AI pulled out highlighted. */
function SourceQuote({ text, marks, onEdit }: { text: string; marks: string[]; onEdit?: () => void }) {
  const needles = [...new Set(marks.map((m) => m.trim()).filter((m) => m.length > 2 && text.includes(m)))];
  let parts: ReactNode[] = [text];
  if (needles.length > 0) {
    const escaped = needles.sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    parts = text.split(new RegExp(`(${escaped.join("|")})`, "g")).map((part, i) =>
      needles.includes(part) ? (
        <mark key={i} className="rounded-[3px] bg-primary/20 px-0.5 text-foreground">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }
  return (
    <div className="flex gap-2.5 rounded-xl border bg-background px-3 py-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
      <Quote className="mt-0.5 size-3.5 shrink-0" />
      <p className="line-clamp-2 min-w-0 flex-1 break-words">{parts}</p>
      {onEdit && (
        <button type="button" onClick={onEdit} className="shrink-0 cursor-pointer text-xs font-medium text-info-strong hover:underline">
          Edit text
        </button>
      )}
    </div>
  );
}

function KindIcon({ kind, className }: { kind: PasteKind; className?: string }) {
  const meta = KIND_META[kind];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-[11px]", meta.tone, className)}>
      <meta.icon className="size-4" />
    </span>
  );
}

function StepRow({ state, children, ms }: { state: "done" | "run" | "wait"; children: ReactNode; ms?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 text-[0.8125rem]", state === "wait" && "text-muted-foreground")}>
      {state === "done" && (
        <span className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success-strong">
          <Check className="size-3 stroke-[2.6]" />
        </span>
      )}
      {state === "run" && <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />}
      {state === "wait" && <span className="size-5 rounded-full border-[1.5px] border-input" />}
      <span className="min-w-0 flex-1">{children}</span>
      {ms && <span className="font-mono text-[0.6875rem] text-muted-foreground">{ms}</span>}
    </div>
  );
}

function Footer({ meta, children }: { meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4.5 flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 px-5.5 py-3.5">
      <span className="mr-auto flex items-center gap-1.5 font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">
        {meta}
      </span>
      {children}
    </div>
  );
}

function MetaDot({ className }: { className?: string }) {
  return <i className={cn("block size-1.5 rounded-full bg-success", className)} />;
}

export function PasteFlow({ onSaved, onCancel }: { onSaved: (saved: PasteSaved) => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [manual, setManual] = useState(false);
  const [classified, setClassified] = useState<ClassifyResult | null>(null);
  const [pickKind, setPickKind] = useState<PasteKind | null>(null);
  const [kind, setKind] = useState<PasteKind | null>(null);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [values, setValues] = useState<Values>({});
  const [aiValues, setAiValues] = useState<Values>({});
  const [followUp, setFollowUp] = useState<"3d" | "none">("3d");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // AI events still waiting for an outcome; anything left when the dialog closes counts as rejected.
  const pendingEvents = useRef(new Set<string>());

  useEffect(() => {
    const pending = pendingEvents.current;
    return () => {
      abortRef.current?.abort();
      for (const id of pending) recordOutcome(id, "rejected");
      pending.clear();
    };
  }, []);

  const pathsQuery = useQuery({
    queryKey: queryKeys.learningPaths,
    queryFn: async (): Promise<LearningPath[]> => {
      const res = await fetch("/api/learning-paths");
      if (!res.ok) throw new Error("Failed to load paths");
      return res.json();
    },
    enabled: kind === "learning",
  });
  const skillsQuery = useQuery({
    queryKey: queryKeys.userSkills,
    queryFn: async (): Promise<{ skills: string[] }> => {
      const res = await fetch("/api/user/skills");
      if (!res.ok) throw new Error("Failed to load skills");
      return res.json();
    },
    enabled: kind === "radar",
  });

  function track(...ids: (string | null | undefined)[]) {
    for (const id of ids) if (id) pendingEvents.current.add(id);
  }
  function settle(id: string | null | undefined, outcome: "accepted" | "edited" | "rejected") {
    if (!id || !pendingEvents.current.has(id)) return;
    pendingEvents.current.delete(id);
    recordOutcome(id, outcome);
  }
  function freshSignal() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }
  function fail(err: unknown, retry: () => void) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    setError({ message: err instanceof ApiError ? err.message : "The AI didn't answer in time.", retry });
    setStep("error");
  }

  async function runClassify(input: string) {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_CHARS) return;
    setStep("classifying");
    setManual(false);
    try {
      const result = await postJson<ClassifyResult>("/api/ai/paste/classify", { text: trimmed }, freshSignal());
      track(result.eventId);
      setClassified(result);
      if (result.gate === "apply" && result.kind !== "other") {
        void runExtract(trimmed, result.kind);
      } else if (result.gate === "confirm") {
        setPickKind(topKinds(result)[0]);
        setStep("pick");
      } else {
        setStep("ask");
      }
    } catch (err) {
      fail(err, () => runClassify(input));
    }
  }

  async function runExtract(input: string, next: PasteKind) {
    // A different type was chosen after a fill: the earlier fill was not used.
    settle(extracted?.eventId, "rejected");
    settle(extracted?.routeEventId, "rejected");
    setKind(next);
    setExtracted(null);
    setStep("extracting");
    try {
      const result = await postJson<ExtractResult>("/api/ai/paste/extract", { text: input.trim(), kind: next }, freshSignal());
      track(result.eventId, result.routeEventId);
      const filled: Values = {};
      for (const field of KIND_FIELDS[next]) {
        const raw = result.fields[field.key] ?? "";
        filled[field.key] = field.type === "url" ? normalizeUrl(raw) : raw.trim();
      }
      if (next === "application") filled.appliedOn = todayIso();
      if (next === "recruiter") {
        filled.jobTitle = result.fields.jobTitle?.trim() ?? "";
        filled._also = result.alsoApplication?.value && filled.jobTitle ? "yes" : "";
      }
      if (next === "learning") filled._path = result.paths?.[0]?.id ?? "";
      if (next === "radar") filled._stack = result.stack?.skill ?? "";
      setExtracted(result);
      setAiValues(filled);
      setValues(filled);
      setFieldErrors({});
      setStep("review");
    } catch (err) {
      fail(err, () => runExtract(input, next));
    }
  }

  function startManual(next: PasteKind) {
    settle(extracted?.eventId, "rejected");
    settle(extracted?.routeEventId, "rejected");
    const blank: Values = next === "application" ? { appliedOn: todayIso() } : {};
    setManual(true);
    setKind(next);
    setExtracted(null);
    setAiValues({});
    setValues(blank);
    setFieldErrors({});
    setStep("review");
  }

  function chooseKind(next: PasteKind) {
    if (manual || !text.trim()) startManual(next);
    else void runExtract(text, next);
  }

  function backToText() {
    abortRef.current?.abort();
    for (const id of pendingEvents.current) recordOutcome(id, "rejected");
    pendingEvents.current.clear();
    setClassified(null);
    setExtracted(null);
    setKind(null);
    setManual(false);
    setStep("input");
  }

  function fillMyself() {
    abortRef.current?.abort();
    if (kind) startManual(kind);
    else {
      setManual(true);
      setStep("ask");
    }
  }

  const activePaths = (pathsQuery.data ?? []).filter((p) => p.status === "active");
  const pathOptions =
    kind === "learning"
      ? activePaths
          .map((p) => ({ id: p.id, title: p.title, probability: extracted?.paths?.find((o) => o.id === p.id)?.probability }))
          .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1))
      : [];
  const selectedPath = values._path || (manual ? pathOptions[0]?.id ?? "" : "");

  const save = useMutation({
    mutationFn: async (): Promise<PasteSaved> => {
      if (!kind) throw new ApiError("Pick a type first.");
      const v: Values = { ...values, _path: selectedPath };
      const parsed = KIND_VALIDATION[kind].safeParse(v);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
        setFieldErrors(errs);
        throw new ApiError("Check the highlighted fields.");
      }
      setFieldErrors({});
      const undo: string[] = [];
      const meta = KIND_META[kind];

      if (kind === "recruiter") {
        const contact = await postJson<{ id: string; name: string }>("/api/recruiter-contacts", {
          name: v.name.trim(),
          company: optional(v.company),
          email: optional(v.email),
          phone: optional(v.phone),
          linkedinUrl: optional(v.linkedinUrl),
          notes: optional(v.notes),
        });
        undo.push(`/api/recruiter-contacts/${contact.id}`);
        if (followUp === "3d") {
          await fetch(`/api/recruiter-contacts/${contact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markContacted: true }),
          });
        }
        let detail: string | undefined;
        if (v._also && v.jobTitle?.trim() && v.company?.trim()) {
          const application = await postJson<{ id: string }>("/api/job-applications", {
            company: v.company.trim(),
            title: v.jobTitle.trim(),
          });
          undo.unshift(`/api/job-applications/${application.id}`);
          detail = "+ 1 application";
        }
        return { title: `${contact.name} added`, detail, href: meta.href, hrefLabel: meta.hrefLabel, undo, eventIds: [] };
      }

      if (kind === "application") {
        const application = await postJson<{ id: string }>("/api/job-applications", {
          company: v.company.trim(),
          title: v.title.trim(),
          url: optional(v.url),
          appliedOn: optional(v.appliedOn),
        });
        undo.push(`/api/job-applications/${application.id}`);
        return { title: "Application added", detail: `${v.title.trim()} at ${v.company.trim()}`, href: meta.href, hrefLabel: meta.hrefLabel, undo, eventIds: [] };
      }

      if (kind === "learning") {
        const item = await postJson<{ id: string }>(`/api/learning-paths/${v._path}/items`, {
          title: v.title.trim(),
          description: optional(v.description),
          resourceUrl: optional(v.resourceUrl),
        });
        undo.push(`/api/learning-items/${item.id}`);
        const pathTitle = activePaths.find((p) => p.id === v._path)?.title;
        return { title: "Step added", detail: pathTitle ? `to ${pathTitle}` : undefined, href: meta.href, hrefLabel: meta.hrefLabel, undo, eventIds: [] };
      }

      if (kind === "radar") {
        const item = await postJson<{ id: string }>("/api/tech-news", {
          title: v.title.trim(),
          url: v.url.trim(),
          source: "manual",
          description: optional(v.description),
          tags: v._stack ? [v._stack] : [],
        });
        undo.push(`/api/tech-news/${item.id}`);
        return { title: "Saved to your radar", href: meta.href, hrefLabel: meta.hrefLabel, undo, eventIds: [] };
      }

      const link = await postJson<{ id: string }>("/api/portfolio-links", { title: v.title.trim(), url: v.url.trim() });
      undo.push(`/api/portfolio-links/${link.id}`);
      return { title: "Link added", detail: v.title.trim(), href: meta.href, hrefLabel: meta.hrefLabel, undo, eventIds: [] };
    },
    onSuccess: (saved) => {
      invalidateAll(queryClient);
      // Outcomes: the type decision, and whether the filled fields were kept as-is.
      const edited = Object.keys({ ...aiValues, ...values }).some((key) => (values[key] ?? "") !== (aiValues[key] ?? ""));
      if (classified?.eventId) settle(classified.eventId, kind === classified.kind ? "accepted" : "edited");
      settle(extracted?.eventId, edited ? "edited" : "accepted");
      settle(extracted?.routeEventId, edited ? "edited" : "accepted");
      const eventIds = [classified?.eventId, extracted?.eventId, extracted?.routeEventId].filter((id): id is string => !!id);
      onSaved({ ...saved, eventIds });
    },
  });

  const set = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const header = {
    input: "A message, job post, course or article link.",
    classifying: "Reading your text…",
    extracting: "Reading your text…",
    pick: "This could be two things.",
    ask: manual ? "What do you want to add?" : "What should this become?",
    review: manual ? "Fill in the details, then save." : "Review what the AI filled in, then save.",
    error: "Something went wrong.",
  }[step];

  const marks = Object.entries(aiValues)
    .filter(([key]) => !["notes", "description", "appliedOn"].includes(key) && !key.startsWith("_"))
    .map(([, value]) => value);

  return (
    <>
      <div className="flex items-start gap-3 px-5.5 pt-5 pr-14">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/15 text-ring">
          <Sparkles className="size-4.5" />
        </span>
        <div>
          <h2 className="text-[1.0625rem] leading-tight font-semibold">Paste anything</h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{header}</p>
        </div>
      </div>

      {step === "input" && (
        <>
          <div className="px-5.5 pt-4">
            <div className="relative">
              <Textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (!text.trim() && pasted.trim()) void runClassify(pasted);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void runClassify(text);
                  }
                }}
                aria-label="Text to read"
                placeholder="Paste here… e.g. a recruiter's LinkedIn message, a job description, a YouTube course link."
                className="min-h-38 resize-none rounded-[14px] border-[1.5px] border-dashed border-ring/50 bg-primary/5 pb-9 text-[0.8125rem] leading-relaxed"
              />
              <span className="pointer-events-none absolute right-3.5 bottom-3 hidden items-center gap-1.5 text-[0.6875rem] text-muted-foreground sm:flex">
                <kbd className="rounded-md border border-b-2 bg-muted px-1.5 font-mono text-[0.625rem]">Ctrl V</kbd> to paste ·
                <kbd className="rounded-md border border-b-2 bg-muted px-1.5 font-mono text-[0.625rem]">Enter</kbd> to read
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PASTE_KINDS.map((k) => {
                const meta = KIND_META[k];
                return (
                  <span key={k} className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs text-muted-foreground">
                    <meta.icon className={cn("size-3.25", meta.tone.split(" ")[1])} />
                    {meta.short}
                  </span>
                );
              })}
            </div>
          </div>
          <Footer
            meta={
              text.length > MAX_CHARS ? (
                <span className="text-destructive-strong">{text.length.toLocaleString()} / 4,000 characters</span>
              ) : (
                "Max 4,000 characters"
              )
            }
          >
            <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              onClick={() => void runClassify(text)}
              disabled={!text.trim() || text.length > MAX_CHARS}
              className="cursor-pointer"
            >
              <Sparkles />
              Read it
            </Button>
          </Footer>
        </>
      )}

      {(step === "classifying" || step === "extracting") && (
        <>
          <div className="px-5.5 pt-4">
            <SourceQuote text={text} marks={[]} />
            <div className="mt-4 flex flex-col gap-2.5">
              {step === "classifying" ? (
                <StepRow state="run">Deciding what it is</StepRow>
              ) : classified && kind === classified.kind ? (
                <StepRow state="done" ms={seconds(classified.ms)}>
                  Decided what it is · <b className="font-medium">{kind && KIND_META[kind].label}</b>
                </StepRow>
              ) : (
                <StepRow state="done">
                  You picked · <b className="font-medium">{kind && KIND_META[kind].label}</b>
                </StepRow>
              )}
              <StepRow state={step === "extracting" ? "run" : "wait"}>Filling the fields</StepRow>
              <StepRow state="wait">Ready to review</StepRow>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9.5 animate-pulse rounded-[10px] bg-muted" />
              ))}
            </div>
          </div>
          <Footer meta="Cancel stops the request">
            <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button disabled className="cursor-pointer">
              Save
            </Button>
          </Footer>
        </>
      )}

      {step === "pick" && classified && (
        <>
          <div className="px-5.5 pt-4">
            <SourceQuote text={text} marks={[]} onEdit={backToText} />
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {topKinds(classified).map((k) => {
                const p = classified.probabilities[k];
                const on = pickKind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPickKind(k)}
                    aria-pressed={on}
                    className={cn(
                      "flex cursor-pointer flex-col gap-2 rounded-[14px] border bg-card p-3 text-left transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
                      on ? "border-ring bg-primary/5 ring-3 ring-primary/20" : "border-input hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <KindIcon kind={k} className="size-8 rounded-[9px]" />
                      <b className="text-[0.8125rem] font-semibold">{KIND_META[k].label}</b>
                      <span className="ml-auto font-mono text-xs font-medium">{percent(p)}</span>
                    </span>
                    <span className="h-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: percent(p) }} />
                    </span>
                    <span className="text-[0.6875rem] leading-snug text-muted-foreground">{KIND_META[k].hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex gap-2.5 rounded-xl border border-primary/35 bg-primary/8 px-3 py-2.5 text-[0.8125rem] leading-relaxed">
              <Info className="mt-0.5 size-4 shrink-0 text-ring" />
              <span>
                The AI is <b className="font-semibold">{percent(classified.confidence)} sure</b>. Pick one and the fields fill in for it.
              </span>
            </p>
          </div>
          <Footer meta={<><MetaDot className="bg-primary" />1 AI call · {seconds(classified.ms)}</>}>
            <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={() => pickKind && void runExtract(text, pickKind)} disabled={!pickKind} className="cursor-pointer">
              Continue as {pickKind ? KIND_META[pickKind].short : "…"}
            </Button>
          </Footer>
        </>
      )}

      {step === "ask" && (
        <>
          <div className="px-5.5 pt-4">
            {text.trim() && <SourceQuote text={text} marks={[]} onEdit={backToText} />}
            <p className={cn("text-[0.8125rem] font-medium", text.trim() && "mt-3.5")}>
              {manual ? "Pick what you want to add." : classified?.kind === "other" || !classified ? "I couldn't tell what this is." : "Pick the type."}{" "}
              <span className="font-normal text-muted-foreground">{manual ? "" : "Pick one, or cancel."}</span>
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PASTE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => chooseKind(k)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-card p-2.5 text-left text-[0.8125rem] font-medium transition-colors outline-none hover:border-ring hover:bg-primary/5 focus-visible:ring-4 focus-visible:ring-ring/20"
                >
                  <KindIcon kind={k} className="size-7 rounded-lg [&_svg]:size-3.5" />
                  {KIND_META[k].short}
                </button>
              ))}
            </div>
          </div>
          <Footer
            meta={
              classified && !manual ? (
                <>
                  <MetaDot className="bg-destructive" />
                  best guess {percent(classified.probabilities[topKinds(classified)[0]])}
                </>
              ) : undefined
            }
          >
            <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
          </Footer>
        </>
      )}

      {step === "error" && error && (
        <>
          <div className="px-5.5 pt-4">
            <p className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-destructive-strong">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                {error.message} Your text is still here. Try again, or fill the form yourself.
              </span>
            </p>
          </div>
          <Footer
            meta={
              <button type="button" onClick={fillMyself} className="cursor-pointer font-sans text-[0.8125rem] font-medium text-muted-foreground hover:text-foreground">
                Fill it myself
              </button>
            }
          >
            <Button variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={() => error.retry()} className="cursor-pointer">
              Try again
            </Button>
          </Footer>
        </>
      )}

      {step === "review" && kind && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="px-5.5 pt-4">
            {text.trim() && <SourceQuote text={text} marks={marks} onEdit={backToText} />}

            <div className={cn("flex items-center gap-3 rounded-[14px] border px-3.5 py-3", text.trim() && "mt-3.5")}>
              <KindIcon kind={kind} className="size-9.5" />
              <div className="min-w-0">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {!manual && classified?.kind === kind && classified.gate === "apply" ? "Looks like a" : "Adding a"}
                </p>
                <p className="text-sm font-semibold">
                  {KIND_META[kind].label}
                  <button
                    type="button"
                    onClick={() => setStep("ask")}
                    className="ml-2.5 cursor-pointer text-xs font-medium text-info-strong hover:underline"
                  >
                    Change
                  </button>
                </p>
              </div>
              {!manual && classified?.kind === kind && <ConfidenceMeter value={classified.probabilities[kind]} />}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
              {KIND_FIELDS[kind].map((field) => (
                <Fragment key={field.key}>
                  <PasteField
                    field={field}
                    value={values[field.key] ?? ""}
                    aiValue={manual ? undefined : aiValues[field.key] ?? ""}
                    error={fieldErrors[field.key]}
                    onChange={(value) => set(field.key, value)}
                  />
                  {field.key === "linkedinUrl" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="paste-followup" className="text-[0.8125rem] font-medium">
                        Next follow-up
                      </label>
                      <select
                        id="paste-followup"
                        value={followUp}
                        onChange={(e) => setFollowUp(e.target.value as "3d" | "none")}
                        className={cn(selectClassName, "h-9.5 text-[0.8125rem]")}
                      >
                        <option value="3d">In 3 days · {followUpLabel()}</option>
                        <option value="none">No reminder</option>
                      </select>
                    </div>
                  )}
                </Fragment>
              ))}

              {kind === "radar" && (skillsQuery.data?.skills.length ?? 0) > 0 && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="paste-stack" className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
                    {!manual && aiValues._stack && <i className="block size-1.5 rounded-full bg-primary" />}
                    Stack tag
                    {!manual && extracted?.stack && aiValues._stack && (
                      <em className="ml-auto text-[0.6875rem] font-normal text-muted-foreground not-italic">
                        {percent(extracted.stack.probability)} sure
                      </em>
                    )}
                  </label>
                  <select
                    id="paste-stack"
                    value={values._stack ?? ""}
                    onChange={(e) => set("_stack", e.target.value)}
                    className={cn(selectClassName, "h-9.5", !manual && values._stack && values._stack === aiValues._stack && "border-primary/40 bg-primary/5")}
                  >
                    <option value="">No tag</option>
                    {skillsQuery.data?.skills.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {kind === "learning" && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
                  {!manual && aiValues._path && <i className="block size-1.5 rounded-full bg-primary" />}
                  Add to path
                </p>
                {pathsQuery.isPending ? (
                  <div className="mt-1.5 h-9.5 animate-pulse rounded-[10px] bg-muted" />
                ) : pathOptions.length === 0 ? (
                  <p className="mt-1.5 rounded-xl border border-dashed px-3 py-2.5 text-[0.8125rem] text-muted-foreground">
                    You have no active learning path.{" "}
                    <Link href="/learning" onClick={onCancel} className="font-medium text-info-strong hover:underline">
                      Create one in Learning
                    </Link>
                  </p>
                ) : (
                  <div role="radiogroup" aria-label="Learning path" className="mt-1.5 flex flex-col gap-1.5">
                    {pathOptions.map((path) => {
                      const on = selectedPath === path.id;
                      return (
                        <button
                          key={path.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set("_path", path.id)}
                          className={cn(
                            "flex h-9.5 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 text-left text-[0.8125rem] outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
                            on ? "border-ring bg-primary/5" : "border-input hover:bg-muted/50"
                          )}
                        >
                          <span className={cn("size-4 shrink-0 rounded-full border-[1.5px] border-input", on && "border-[5px] border-ring")} />
                          <span className="min-w-0 flex-1 truncate">{path.title}</span>
                          {!manual && path.probability !== undefined && (
                            <span className={cn("font-mono text-[0.6875rem] font-medium", on ? "text-warning-strong" : "text-muted-foreground")}>
                              {percent(path.probability)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {fieldErrors._path && <p className="mt-1.5 text-xs text-destructive-strong">{fieldErrors._path}</p>}
              </div>
            )}

            {kind === "recruiter" && values.jobTitle?.trim() && (
              <label className="mt-3.5 flex cursor-pointer items-center gap-3 rounded-xl border border-info/30 bg-info/6 px-3.5 py-2.75 text-[0.8125rem]">
                <Checkbox
                  checked={!!values._also}
                  disabled={!values.company?.trim()}
                  onCheckedChange={(checked) => set("_also", checked ? "yes" : "")}
                />
                <span className="min-w-0 flex-1">
                  <b className="font-medium">Also add an application</b>{" "}
                  <span className="text-muted-foreground">
                    · {values.jobTitle.trim()}
                    {values.company?.trim() ? ` at ${values.company.trim()}` : " (add the company first)"}
                  </span>
                </span>
                {!manual && extracted?.alsoApplication && (
                  <span className="shrink-0 font-mono text-[0.6875rem] font-medium text-info-strong">
                    yes · {percent(extracted.alsoApplication.probability)}
                  </span>
                )}
              </label>
            )}

            {!manual && (
              <p className="mt-3 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <i className="block size-1.5 rounded-full bg-primary" />
                Filled by AI from your text. Nothing is saved until you click Save.
              </p>
            )}
            {save.isError && (
              <p className="mt-3 text-[0.8125rem] text-destructive-strong">
                {save.error instanceof ApiError ? save.error.message : "Couldn't save. Please try again."}
              </p>
            )}
          </div>
          <Footer
            meta={
              manual ? (
                "Filled by you"
              ) : (
                <>
                  <MetaDot />
                  {1 + (classified ? 1 : 0) + (extracted?.routeEventId ? 1 : 0)} AI calls ·{" "}
                  {seconds((classified?.ms ?? 0) + (extracted?.ms ?? 0))}
                </>
              )
            }
          >
            <Button type="button" variant="ghost" onClick={onCancel} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || (kind === "learning" && pathOptions.length === 0)} className="cursor-pointer">
              <Check />
              {save.isPending
                ? "Saving…"
                : kind === "recruiter" && values._also && values.jobTitle?.trim() && values.company?.trim()
                  ? "Save recruiter + application"
                  : SAVE_LABEL[kind]}
            </Button>
          </Footer>
        </form>
      )}
    </>
  );
}

function PasteField({
  field,
  value,
  aiValue,
  error,
  onChange,
}: {
  field: FieldDef;
  value: string;
  /** undefined in manual mode */
  aiValue: string | undefined;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `paste-${field.key}`;
  const aiFilled = aiValue !== undefined && aiValue !== "" && field.type !== "date";
  const untouched = aiFilled && value === aiValue;
  const notFound = aiValue !== undefined && aiValue === "" && field.type !== "date";
  const shared = cn(
    untouched && "border-primary/40 bg-primary/5 dark:bg-primary/5",
    field.mono && "font-mono",
    "text-[0.8125rem]"
  );
  return (
    <div className={cn("flex flex-col gap-1.5", field.full && "sm:col-span-2")}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-[0.8125rem] font-medium">
        {aiFilled && <i className="block size-1.5 rounded-full bg-primary" />}
        {field.label}
        {notFound && <em className="ml-auto text-[0.6875rem] font-normal text-muted-foreground not-italic">not found</em>}
      </label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn("min-h-16", shared)}
        />
      ) : (
        <Input
          id={id}
          type={field.type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={!!error || undefined}
          className={cn("h-9.5", shared)}
        />
      )}
      {error && <p className="text-xs text-destructive-strong">{error}</p>}
    </div>
  );
}

/** The two most likely real types (never "other"). */
function topKinds(result: ClassifyResult): PasteKind[] {
  return [...PASTE_KINDS].sort((a, b) => result.probabilities[b] - result.probabilities[a]).slice(0, 2);
}

export function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of [
    queryKeys.recruiterContacts,
    queryKeys.jobApplications,
    queryKeys.notificationsSummary,
    queryKeys.learningPaths,
    queryKeys.techNews,
    queryKeys.portfolioLinks,
  ]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
