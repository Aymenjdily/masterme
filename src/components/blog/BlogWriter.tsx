"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  FolderKanban,
  Info,
  Newspaper,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify, wordCount, type BlogSection } from "@/lib/portable-text";
import type { BlogDraft, BlogLanguage, BlogLength, BlogSourceKind, SuggestResult, WriteResult } from "@/lib/ai/blog-kinds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { percent } from "@/components/ai/ConfidenceMeter";
import { recordOutcome } from "@/components/ai/PasteAnything";
import { showToast } from "@/components/ai/Toast";
import { SectionBody } from "@/components/blog/PostPreview";
import { blogPostsKey } from "@/components/blog/BlogCard";

const SOURCE_ICON: Record<BlogSourceKind, typeof FolderKanban> = { project: FolderKanban, learning: BookOpen, radar: Newspaper };
const SOURCE_TONE: Record<BlogSourceKind, string> = {
  project: "bg-special/12 text-special-strong",
  learning: "bg-success/15 text-success-strong",
  radar: "bg-stone/45 text-stone-strong",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Something went wrong.");
  return data as T;
}

/** "## Heading\nbody" ⇄ section, for the plain-text section editor. */
const sectionToText = (s: BlogSection) => `## ${s.heading}\n${s.markdown}`;
function textToSection(text: string): BlogSection {
  const [first, ...rest] = text.replace(/\r\n/g, "\n").split("\n");
  const heading = first.match(/^\s*#{1,2}\s+(.*)$/);
  return heading ? { heading: heading[1].trim(), markdown: rest.join("\n").trim() } : { heading: "", markdown: text.trim() };
}

export function BlogWriter() {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [ownTopic, setOwnTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState<BlogLanguage | null>(null);
  const [length, setLength] = useState<BlogLength>("medium");
  const [status, setStatus] = useState<"idle" | "writing" | "covered" | "draft" | "error" | "sent">("idle");
  const [error, setError] = useState("");
  const [covered, setCovered] = useState<{ title: string; probability: number } | null>(null);
  const [draft, setDraft] = useState<BlogDraft | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [facts, setFacts] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);
  const [rewriting, setRewriting] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ studioUrl: string } | null>(null);
  const pending = useRef(new Set<string>());

  const suggest = useQuery({
    queryKey: ["blog-suggest"],
    queryFn: async (): Promise<SuggestResult> => {
      const res = await fetch("/api/ai/blog/suggest");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Couldn't load ideas.");
      return data;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    const events = pending.current;
    return () => {
      for (const id of events) recordOutcome(id, "rejected");
      events.clear();
    };
  }, []);

  const topics = suggest.data?.topics ?? [];
  const pickedTopic = topics.find((t) => t.sourceKey === picked);
  const topic = pickedTopic ? pickedTopic.title : ownTopic.trim();
  const lang: BlogLanguage = language ?? suggest.data?.language.choice ?? "en";
  const aiLangP = suggest.data?.language.probabilities[lang];
  const words = draft ? wordCount(draft.sections) : 0;
  const codeBlocks = draft ? draft.sections.reduce((n, s) => n + (s.markdown.match(/```/g)?.length ?? 0) / 2, 0) : 0;

  function track(ids: (string | null | undefined)[]) {
    for (const id of ids) if (id) pending.current.add(id);
  }
  function settleAll(outcome: "accepted" | "edited" | "rejected") {
    for (const id of pending.current) recordOutcome(id, outcome);
    pending.current.clear();
  }

  async function write(force = false) {
    if (topic.length < 3) return;
    setStatus("writing");
    setError("");
    setEditing(null);
    // A new draft replaces the old one: the old one wasn't used.
    settleAll("rejected");
    try {
      const result = await postJson<WriteResult>("/api/ai/blog/write", {
        topic,
        notes: notes.trim() || undefined,
        sourceKey: pickedTopic?.sourceKey,
        language: lang,
        length,
        force,
      });
      if ("covered" in result) {
        track([result.eventId]);
        setCovered(result.covered);
        setStatus("covered");
        return;
      }
      track(result.eventIds);
      if (pickedTopic) for (const id of suggest.data?.eventIds ?? []) recordOutcome(id, "accepted");
      setDraft(result.draft);
      setAiDraft(JSON.stringify(result.draft));
      setFacts(result.factsUsed);
      setSent(null);
      setStatus("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI didn't finish the draft.");
      setStatus("error");
    }
  }

  async function rewrite(index: number) {
    if (!draft) return;
    setRewriting(index);
    try {
      const { section, eventId } = await postJson<{ section: BlogSection; eventId: string | null }>("/api/ai/blog/rewrite", {
        title: draft.title,
        notes: notes.trim() || undefined,
        sourceKey: pickedTopic?.sourceKey,
        language: lang,
        heading: draft.sections[index].heading,
        markdown: draft.sections[index].markdown,
      });
      track([eventId]);
      setDraft({ ...draft, sections: draft.sections.map((s, i) => (i === index ? section : s)) });
    } catch (err) {
      showToast({ title: err instanceof Error ? err.message : "Couldn't rewrite this section." });
    } finally {
      setRewriting(null);
    }
  }

  async function send() {
    if (!draft) return;
    setSending(true);
    try {
      const result = await postJson<{ id: string; slug: string; studioUrl: string }>("/api/blog/drafts", draft);
      settleAll(JSON.stringify(draft) === aiDraft ? "accepted" : "edited");
      setSent({ studioUrl: result.studioUrl });
      setStatus("sent");
      queryClient.invalidateQueries({ queryKey: blogPostsKey });
      showToast({ title: "Draft saved to Sanity", detail: "· not published", link: { href: result.studioUrl, label: "Open in Studio" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the draft to Sanity.");
    } finally {
      setSending(false);
    }
  }

  function discard() {
    settleAll("rejected");
    setDraft(null);
    setAiDraft(null);
    setStatus("idle");
  }

  const updateDraft = (change: Partial<BlogDraft>) => setDraft((d) => (d ? { ...d, ...change } : d));

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/portfolio" className="mb-1.5 inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" />
            Portfolio · Blog
          </Link>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Write a post with AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Drafts go to your Sanity blog. Nothing is published from here.</p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[0.65625rem] font-medium text-success-strong">
          <span className="size-1.5 rounded-full bg-success ring-3 ring-success/20" />
          Connected to Sanity
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[360px_1fr]">
        {/* ---------- Setup ---------- */}
        <Card className="gap-0 rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <Sparkles className="size-4 text-ring" />
            What to write about
          </h2>

          <p className="mt-3.5 mb-1.5 flex items-center text-[0.8125rem] font-medium">
            Suggested from your work
            <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">fits your blog</span>
          </p>
          {suggest.isPending && (
            <div className="flex flex-col gap-1.5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-15 rounded-[11px]" />
              ))}
            </div>
          )}
          {suggest.isError && (
            <p className="rounded-[11px] border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              {suggest.error.message}{" "}
              <button type="button" onClick={() => suggest.refetch()} className="cursor-pointer font-medium text-info-strong hover:underline">
                Retry
              </button>
            </p>
          )}
          {suggest.data && topics.length === 0 && (
            <p className="rounded-[11px] border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
              Add projects or learning paths to get ideas, or write your own topic below.
            </p>
          )}
          <div role="radiogroup" aria-label="Suggested topics" className="flex flex-col gap-1.5">
            {topics.map((t) => {
              const Icon = SOURCE_ICON[t.source.kind];
              const on = picked === t.sourceKey;
              return (
                <button
                  key={t.sourceKey}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(on ? null : t.sourceKey)}
                  className={cn(
                    "grid cursor-pointer grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 rounded-[11px] border bg-card px-3 py-2.25 text-left outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/20",
                    on ? "border-ring bg-primary/5 ring-3 ring-primary/20" : "hover:bg-background"
                  )}
                >
                  <span className="text-[0.8125rem] leading-snug font-medium">{t.title}</span>
                  <span className="font-mono text-[0.6875rem] font-medium text-warning-strong">{percent(t.fit)}</span>
                  <span className={cn("col-span-2 inline-flex h-5 w-max items-center gap-1 rounded-md px-1.5 font-mono text-[0.65625rem] font-medium", SOURCE_TONE[t.source.kind])}>
                    <Icon className="size-2.75" />
                    {t.source.name}
                  </span>
                </button>
              );
            })}
          </div>

          <label htmlFor="blog-topic" className="mt-3.5 mb-1.5 text-[0.8125rem] font-medium">
            Or your own topic
          </label>
          <Input
            id="blog-topic"
            value={ownTopic}
            maxLength={200}
            onChange={(e) => {
              setOwnTopic(e.target.value);
              if (e.target.value) setPicked(null);
            }}
            placeholder="e.g. Why I stopped using Vercel for side projects"
            className="text-[0.8125rem]"
          />

          <label htmlFor="blog-notes" className="mt-3.5 mb-1.5 flex items-center text-[0.8125rem] font-medium">
            Your notes
            <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">the AI only uses these facts</span>
          </label>
          <Textarea
            id="blog-notes"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What you built, numbers you're sure of, what went wrong…"
            className="min-h-22 text-[0.8125rem]"
          />

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-medium">
                {!language && aiLangP !== undefined && <i className="block size-1.5 rounded-full bg-primary" />}
                Language
                {!language && aiLangP !== undefined && (
                  <em className="ml-auto font-mono text-[0.65625rem] font-medium text-warning-strong not-italic">
                    {lang.toUpperCase()} {percent(aiLangP)}
                  </em>
                )}
              </p>
              <SegmentedControl
                label="Language"
                value={lang}
                onChange={setLanguage}
                options={[
                  { value: "en", label: "English" },
                  { value: "fr", label: "Français" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[0.8125rem] font-medium">Length</p>
              <SegmentedControl
                label="Length"
                value={length}
                onChange={setLength}
                options={[
                  { value: "short", label: "Short" },
                  { value: "medium", label: "Medium" },
                  { value: "long", label: "Long" },
                ]}
              />
            </div>
          </div>

          <p className="mt-3.5 rounded-[11px] bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <b className="font-medium text-foreground">Your voice:</b> learned from the titles and excerpts of your last published
            posts. First person, practical, code where it helps.
          </p>

          <Button onClick={() => write()} disabled={topic.length < 3 || status === "writing"} className="mt-4 cursor-pointer">
            {draft ? <RefreshCw /> : <Sparkles />}
            {status === "writing" ? "Writing…" : draft ? "Rewrite draft" : "Write draft"}
          </Button>
        </Card>

        {/* ---------- Preview ---------- */}
        <Card className="gap-0 overflow-hidden rounded-[20px] py-0">
          {status === "idle" && (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border bg-background text-ring">
                <Sparkles className="size-5" />
              </span>
              <p className="mt-3.5 text-sm font-semibold">Pick a topic, then Write draft</p>
              <p className="mt-1 max-w-sm text-[0.8125rem] text-muted-foreground">
                Add a few notes: the AI only writes what you tell it and what&apos;s in your data. You can edit everything before it goes to Sanity.
              </p>
            </div>
          )}

          {status === "writing" && (
            <div className="px-6 py-6">
              <div className="flex flex-col gap-2.5 text-[0.8125rem]">
                <p className="flex items-center gap-2.5">
                  <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />
                  Checking it isn&apos;t already on your blog, then writing
                </p>
              </div>
              <div className="mt-6 h-6 w-3/4 animate-pulse rounded-md bg-muted" />
              {[100, 100, 80, 40, 100, 90, 60].map((w, i) => (
                <div key={i} className="mt-3 h-3 animate-pulse rounded-md bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {status === "covered" && covered && (
            <div className="px-6 py-6">
              <p className="flex gap-2.5 rounded-xl border border-primary/35 bg-primary/8 px-3.5 py-3 text-[0.8125rem] leading-relaxed">
                <Info className="mt-0.5 size-4 shrink-0 text-ring" />
                <span>
                  This looks close to &ldquo;<b className="font-semibold">{covered.title}</b>&rdquo; ({percent(covered.probability)}). Write a
                  different angle (add it to your notes), or continue anyway.
                </span>
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => document.getElementById("blog-notes")?.focus()} className="cursor-pointer">
                  Change the angle
                </Button>
                <Button onClick={() => write(true)} className="cursor-pointer">
                  Continue anyway
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="px-6 py-6">
              <p className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3.5 py-3 text-[0.8125rem] text-destructive-strong">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            </div>
          )}

          {(status === "draft" || status === "sent") && draft && (
            <>
              <div className="flex flex-wrap items-center gap-2.5 border-b bg-muted/40 px-4.5 py-3">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-[0.65625rem] font-medium tracking-wider whitespace-nowrap uppercase",
                    sent ? "bg-success/15 text-success-strong" : "bg-primary/15 text-warning-strong"
                  )}
                >
                  {sent ? "In Sanity · draft" : "AI draft"}
                </span>
                <span className="font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                  ~{words.toLocaleString()} words · {Math.max(1, Math.round(words / 220))} min read · {draft.sections.length} sections
                  {codeBlocks ? ` · ${codeBlocks} code block${codeBlocks === 1 ? "" : "s"}` : ""}
                </span>
                <div className="ml-auto flex gap-2">
                  {sent ? (
                    <>
                      <Button variant="ghost" onClick={discard} className="h-8.5 cursor-pointer">
                        Write another
                      </Button>
                      <Button nativeButton={false} render={<a href={sent.studioUrl} target="_blank" rel="noreferrer" />} className="h-8.5 cursor-pointer">
                        Open in Studio
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={discard} className="h-8.5 cursor-pointer">
                        Discard
                      </Button>
                      <Button onClick={send} disabled={sending || editing !== null} className="h-8.5 cursor-pointer">
                        <Send />
                        {sending ? "Sending…" : "Send to Sanity as draft"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className={cn("px-5 py-5 sm:px-8", sent && "pointer-events-none opacity-80")}>
                {error && status === "draft" && (
                  <p className="mb-4 flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3.5 py-2.5 text-[0.8125rem] text-destructive-strong">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {error} Your draft is still here.
                  </p>
                )}
                <Textarea
                  aria-label="Title"
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  onBlur={() => !draft.slug && updateDraft({ slug: slugify(draft.title) })}
                  className="field-sizing-content min-h-0 resize-none border-transparent px-1.5 py-0.5 text-[1.5rem] leading-tight font-semibold tracking-tight shadow-none hover:border-input focus-visible:border-ring md:text-[1.5rem]"
                />
                <div className="mt-1 flex items-center gap-1 px-1.5 font-mono text-[0.71875rem] text-muted-foreground">
                  /blog/
                  <input
                    aria-label="Slug"
                    value={draft.slug}
                    onChange={(e) => updateDraft({ slug: slugify(e.target.value) || e.target.value.toLowerCase() })}
                    className="min-w-0 flex-1 rounded bg-transparent outline-none focus:bg-muted"
                  />
                </div>
                <div className="mt-3 rounded-r-lg border-l-3 border-primary bg-primary/5 px-3 py-2">
                  <p className="font-mono text-[0.625rem] font-medium tracking-widest text-warning-strong uppercase">Excerpt</p>
                  <Textarea
                    aria-label="Excerpt"
                    value={draft.excerpt}
                    maxLength={400}
                    onChange={(e) => updateDraft({ excerpt: e.target.value })}
                    className="field-sizing-content min-h-0 resize-none border-0 bg-transparent px-0 py-0.5 text-[0.84rem] shadow-none focus-visible:ring-0 md:text-[0.84rem]"
                  />
                </div>

                {draft.sections.map((section, i) => (
                  <section key={i} className="group/sec relative -mx-2.5 mt-4 rounded-xl px-2.5 py-1.5 hover:bg-background">
                    {editing?.index === i ? (
                      <div>
                        <Textarea
                          autoFocus
                          aria-label={`Edit section ${i + 1}`}
                          value={editing.text}
                          onChange={(e) => setEditing({ index: i, text: e.target.value })}
                          className="field-sizing-content min-h-32 font-mono text-[0.78rem] leading-relaxed"
                        />
                        <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">## heading · ### subheading · - list · **bold** · ```lang code ```</p>
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="cursor-pointer">
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              updateDraft({ sections: draft.sections.map((s, j) => (j === i ? textToSection(editing.text) : s)) });
                              setEditing(null);
                            }}
                            className="cursor-pointer"
                          >
                            <Check />
                            Save section
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute top-1.5 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within/sec:opacity-100 group-hover/sec:opacity-100">
                          <Button size="xs" variant="outline" onClick={() => setEditing({ index: i, text: sectionToText(section) })} className="cursor-pointer bg-card">
                            <Pencil />
                            Edit
                          </Button>
                          <Button size="xs" variant="outline" disabled={rewriting !== null} onClick={() => rewrite(i)} className="cursor-pointer bg-card">
                            <RefreshCw className={cn(rewriting === i && "animate-spin")} />
                            {rewriting === i ? "Rewriting…" : "Rewrite"}
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="outline"
                            aria-label={`Delete section ${section.heading}`}
                            disabled={draft.sections.length <= 1}
                            onClick={() => updateDraft({ sections: draft.sections.filter((_, j) => j !== i) })}
                            className="cursor-pointer bg-card"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                        {section.heading && <h3 className="pr-44 text-lg font-semibold tracking-tight">{section.heading}</h3>}
                        <div className={cn(rewriting === i && "animate-pulse opacity-60")}>
                          <SectionBody markdown={section.markdown} />
                        </div>
                      </>
                    )}
                  </section>
                ))}

                <p className="mt-5 text-xs text-muted-foreground">
                  Facts used: {facts.length ? facts.map((f) => <b key={f} className="font-medium text-foreground">{f} · </b>) : null}
                  no invented numbers. Check anything you&apos;re not sure of before publishing.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
