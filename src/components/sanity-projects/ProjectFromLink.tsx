"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronLeft, Globe, ImageOff, Info, Link2, RefreshCw, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/portable-text";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  STATUS_LABEL,
  TYPE_LABEL,
  type GenerateProjectResult,
  type SanityProjectDraft,
} from "@/lib/ai/sanity-project-kinds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui-patterns/dialogs";
import { percent } from "@/components/ai/ConfidenceMeter";
import { recordOutcome } from "@/components/ai/PasteAnything";
import { showToast } from "@/components/ai/Toast";
import { sanityProjectsKey } from "@/components/sanity-projects/ProjectsCard";

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 fill-current" aria-hidden>
    <path d="M12 .5a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .5z" />
  </svg>
);

function Field({ label, ai, extra, children, className }: { label: string; ai?: boolean; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.8125rem] font-medium">
        {ai && <i className="block size-1.5 rounded-full bg-primary" />}
        {label}
        {extra && <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">{extra}</span>}
      </p>
      {children}
    </div>
  );
}

const areaClass = "field-sizing-content min-h-20 text-[0.8125rem] leading-relaxed md:text-[0.8125rem]";

export function ProjectFromLink() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "draft" | "error" | "sent">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenerateProjectResult | null>(null);
  const [draft, setDraft] = useState<SanityProjectDraft | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [showLong, setShowLong] = useState(false);
  const [newTech, setNewTech] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ studioUrl: string; siteUrl: string | null; published: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    const events = pending.current;
    return () => {
      for (const id of events) recordOutcome(id, "rejected");
      events.clear();
    };
  }, []);

  function settleAll(outcome: "accepted" | "edited" | "rejected") {
    for (const id of pending.current) recordOutcome(id, outcome);
    pending.current.clear();
  }

  const update = (change: Partial<SanityProjectDraft>) => setDraft((d) => (d ? { ...d, ...change } : d));

  async function read() {
    setStatus("reading");
    setError("");
    settleAll("rejected");
    try {
      const res = await fetch("/api/ai/sanity-project/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() || undefined, repoUrl: repoUrl.trim() || undefined, notes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Couldn't read that project.");
      const next = data as GenerateProjectResult;
      for (const id of next.eventIds) pending.current.add(id);
      setResult(next);
      setDraft(next.draft);
      setAiDraft(JSON.stringify(next.draft));
      setSent(null);
      setStatus("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that project.");
      setStatus("error");
    }
  }

  async function send(publish: boolean) {
    if (!draft) return;
    setSending(true);
    setConfirming(false);
    setError("");
    try {
      const res = await fetch("/api/sanity/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, technologies: draft.technologies.map((t) => t.name), preview: draft.preview ?? "", source: draft.source ?? "", image: draft.image ?? "", publish }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Couldn't save the project to Sanity.");
      settleAll(JSON.stringify(draft) === aiDraft ? "accepted" : "edited");
      setSent({ studioUrl: data.studioUrl, siteUrl: data.siteUrl ?? null, published: !!data.published });
      setStatus("sent");
      queryClient.invalidateQueries({ queryKey: sanityProjectsKey });
      const cover = data.imageSkipped ? ", add the cover in the Studio" : "";
      showToast(
        data.published
          ? {
              title: `${draft.title} published`,
              detail: `· live on your site${cover}`,
              link: data.siteUrl ? { href: data.siteUrl, label: "View on site" } : { href: data.studioUrl, label: "Open in Studio" },
            }
          : { title: `${draft.title} saved to Sanity`, detail: `· draft${cover}`, link: { href: data.studioUrl, label: "Open in Studio" } }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the project to Sanity.");
    } finally {
      setSending(false);
    }
  }

  function discard() {
    settleAll("rejected");
    setDraft(null);
    setResult(null);
    setStatus("idle");
  }

  const found = result?.found;
  const probs = result?.probabilities;
  const canRead = (url.trim() || repoUrl.trim()) && status !== "reading";
  const imageIndex = draft?.image ? draft.images.indexOf(draft.image) : -1;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/portfolio" className="mb-1.5 inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-3.5" />
            Portfolio · Projects
          </Link>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Add a project from a link</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fills every field of your Sanity project. Review it, then publish to your site or save it as a draft.
          </p>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[0.65625rem] font-medium text-success-strong">
          <span className="size-1.5 rounded-full bg-success ring-3 ring-success/20" />
          Sanity{found ? ` · ${found.projectCount} projects` : ""}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_1fr]">
        {/* ---------- Sources ---------- */}
        <Card className="gap-0 rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
          <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            <Link2 className="size-4 text-ring" />
            From a link
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canRead) void read();
            }}
          >
            <label htmlFor="pj-url" className="mt-3.5 mb-1.5 block text-[0.8125rem] font-medium">
              Live site
            </label>
            <div className="relative">
              <Globe className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input id="pj-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="pl-8.5 font-mono text-[0.78rem] md:text-[0.78rem]" />
            </div>
            <label htmlFor="pj-repo" className="mt-3.5 mb-1.5 flex text-[0.8125rem] font-medium">
              GitHub repo
              <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">optional</span>
            </label>
            <div className="relative">
              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">{GITHUB_ICON}</span>
              <Input id="pj-repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="github.com/you/repo" className="pl-8.5 font-mono text-[0.78rem] md:text-[0.78rem]" />
            </div>
            <label htmlFor="pj-notes" className="mt-3.5 mb-1.5 flex text-[0.8125rem] font-medium">
              Your notes
              <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">optional, facts only</span>
            </label>
            <Textarea id="pj-notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} placeholder="Who it's for, your role, what's special…" className="min-h-20 text-[0.8125rem] md:text-[0.8125rem]" />
            <Button type="submit" disabled={!canRead} className="mt-4 w-full cursor-pointer">
              {draft ? <RefreshCw /> : <Sparkles />}
              {status === "reading" ? "Reading…" : draft ? "Read again" : "Read and fill"}
            </Button>
          </form>

          {found && (
            <div className="mt-4 border-t pt-3.5">
              <p className="font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">What I found</p>
              <ul className="mt-1.5 flex flex-col gap-2 text-[0.8125rem] leading-snug">
                {found.site && (
                  <FoundItem ok={!("error" in found.site)}>
                    {"error" in found.site ? (
                      <span className="text-muted-foreground">Site: {found.site.error}</span>
                    ) : (
                      <>
                        <b className="font-medium">Site:</b> &ldquo;{found.site.title ?? "untitled"}&rdquo;{" "}
                        <span className="text-muted-foreground">
                          · {found.site.loginOnly ? "login page, used the title only" : `${found.site.words.toLocaleString()} words read`}
                        </span>
                      </>
                    )}
                  </FoundItem>
                )}
                {found.repo && (
                  <FoundItem ok={!("error" in found.repo)}>
                    {"error" in found.repo ? (
                      <span className="text-muted-foreground">Repo: {found.repo.error}</span>
                    ) : (
                      <>
                        <b className="font-medium">Repo:</b> {found.repo.readme ? "README and " : ""}package.json{" "}
                        <span className="text-muted-foreground">· {found.repo.dependencies} dependencies</span>
                      </>
                    )}
                  </FoundItem>
                )}
                {!found.repo && (
                  <FoundItem ok={false}>
                    <span className="text-muted-foreground">No GitHub repo: add one for exact tech and the source link</span>
                  </FoundItem>
                )}
                {found.stack.length > 0 && (
                  <FoundItem ok>
                    <b className="font-medium">Stack</b> from package.json: {found.stack.slice(0, 6).join(", ")}
                    {found.stack.length > 6 ? ` +${found.stack.length - 6}` : ""}
                  </FoundItem>
                )}
                <FoundItem ok={!!draft?.images.length}>
                  {draft?.images.length ? (
                    <>
                      <b className="font-medium">Cover image</b> <span className="text-muted-foreground">· {draft.images.length} option{draft.images.length === 1 ? "" : "s"}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No cover image found: add one in the Studio</span>
                  )}
                </FoundItem>
                {found.duplicate ? (
                  <FoundItem ok={false} warn>
                    <b className="font-medium">Already in your portfolio</b> as{" "}
                    <a href={found.duplicate.studioUrl} target="_blank" rel="noreferrer" className="font-medium text-info-strong hover:underline">
                      {found.duplicate.title}
                    </a>
                  </FoundItem>
                ) : (
                  <FoundItem ok>
                    <b className="font-medium">Not in your portfolio yet</b> <span className="text-muted-foreground">· checked {found.projectCount} projects</span>
                  </FoundItem>
                )}
              </ul>
            </div>
          )}
        </Card>

        {/* ---------- Review ---------- */}
        <Card className="gap-0 overflow-hidden rounded-[20px] py-0">
          {status === "idle" && (
            <div className="flex flex-col items-center px-6 py-20 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border bg-background text-ring">
                <Link2 className="size-5" />
              </span>
              <p className="mt-3.5 text-sm font-semibold">Paste the live site, then Read and fill</p>
              <p className="mt-1 max-w-sm text-[0.8125rem] text-muted-foreground">
                Add the GitHub repo for the exact stack and source link. Everything stays editable before it goes to Sanity.
              </p>
            </div>
          )}

          {status === "reading" && (
            <div className="px-6 py-6">
              <p className="flex items-center gap-2.5 text-[0.8125rem]">
                <span className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-ring" />
                Reading the site{repoUrl.trim() ? " and the repo" : ""}, then writing the project fields
              </p>
              <div className="mt-6 grid grid-cols-[1.3fr_1fr] gap-4">
                <div className="aspect-video animate-pulse rounded-xl bg-muted" />
                <div className="flex flex-col gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              </div>
              {[100, 90, 100, 60].map((w, i) => (
                <div key={i} className="mt-3 h-3 animate-pulse rounded-md bg-muted" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="px-6 py-6">
              <p className="flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-destructive-strong">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            </div>
          )}

          {(status === "draft" || status === "sent") && draft && result && (
            <>
              <div className="flex flex-wrap items-center gap-2.5 border-b bg-muted/40 px-4.5 py-3">
                <span className={cn("rounded-md px-2 py-0.5 font-mono text-[0.65625rem] font-medium tracking-wider whitespace-nowrap uppercase", sent ? "bg-success/15 text-success-strong" : "bg-primary/15 text-warning-strong")}>
                  {sent ? (sent.published ? "Published" : "In Sanity · draft") : "AI draft"}
                </span>
                <span className="font-mono text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                  {result.aiCalls} AI calls · {(result.ms / 1000).toFixed(1)}s
                </span>
                <div className="ml-auto flex gap-2">
                  {sent ? (
                    <>
                      <Button variant="ghost" onClick={discard} className="h-8.5 cursor-pointer">
                        Add another
                      </Button>
                      <Button variant="outline" nativeButton={false} render={<a href={sent.studioUrl} target="_blank" rel="noreferrer" />} className="h-8.5 cursor-pointer">
                        Open in Studio
                      </Button>
                      {sent.siteUrl && (
                        <Button nativeButton={false} render={<a href={sent.siteUrl} target="_blank" rel="noreferrer" />} className="h-8.5 cursor-pointer">
                          View on site
                        </Button>
                      )}
                    </>
                  ) : confirming ? (
                    <>
                      <span className="self-center text-[0.8125rem] font-medium">
                        Publish now? It goes live on your site{draft.image ? "." : " without a cover image."}
                      </span>
                      <Button variant="ghost" onClick={() => setConfirming(false)} className="h-8.5 cursor-pointer">
                        Cancel
                      </Button>
                      <Button onClick={() => send(true)} disabled={sending} className="h-8.5 cursor-pointer">
                        <Globe />
                        Publish now
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={discard} className="h-8.5 cursor-pointer">
                        Discard
                      </Button>
                      <Button variant="outline" onClick={() => send(false)} disabled={sending || !draft.title.trim() || !draft.description.trim()} className="h-8.5 cursor-pointer">
                        <Send />
                        Save as draft
                      </Button>
                      <Button onClick={() => setConfirming(true)} disabled={sending || !draft.title.trim() || !draft.description.trim()} className="h-8.5 cursor-pointer">
                        <Globe />
                        {sending ? "Sending…" : "Publish to site"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className={cn("px-5 py-5", sent && "pointer-events-none opacity-80")}>
                {found?.duplicate && !sent && (
                  <p className="mb-4 flex gap-2.5 rounded-xl border border-primary/35 bg-primary/8 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed">
                    <Info className="mt-0.5 size-4 shrink-0 text-ring" />
                    <span>
                      <b className="font-semibold">{found.duplicate.title}</b> already uses this site. Update it in the Studio, or add this as a separate project anyway.
                    </span>
                  </p>
                )}
                {error && status === "draft" && (
                  <p className="mb-4 flex gap-2.5 rounded-xl border border-destructive/25 bg-destructive/6 px-3.5 py-2.5 text-[0.8125rem] text-destructive-strong">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {error} Your draft is still here.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_1fr]">
                  <Field label="Cover image" ai={!!draft.image}>
                    <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
                      {draft.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={draft.image} alt="Cover" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
                          <ImageOff className="size-5" />
                          No cover · add it in the Studio
                        </div>
                      )}
                      <div className="absolute right-2 bottom-2 flex gap-1.5">
                        {draft.images.length > 1 && (
                          <Button size="xs" variant="outline" onClick={() => update({ image: draft.images[(imageIndex + 1) % draft.images.length] })} className="cursor-pointer bg-card">
                            Change
                          </Button>
                        )}
                        {draft.image ? (
                          <Button size="xs" variant="outline" onClick={() => update({ image: null })} className="cursor-pointer bg-card">
                            Remove
                          </Button>
                        ) : (
                          draft.images.length > 0 && (
                            <Button size="xs" variant="outline" onClick={() => update({ image: draft.images[0] })} className="cursor-pointer bg-card">
                              Use image
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </Field>

                  <div className="flex flex-col gap-3">
                    <Field label="Title" ai>
                      <Input value={draft.title} onChange={(e) => update({ title: e.target.value })} onBlur={() => !draft.slug && update({ slug: slugify(draft.title) })} className="bg-primary/5 text-[0.8125rem] md:text-[0.8125rem]" />
                    </Field>
                    <Field label="Slug">
                      <Input value={draft.slug} onChange={(e) => update({ slug: slugify(e.target.value) || e.target.value.toLowerCase() })} className="font-mono text-[0.78rem] md:text-[0.78rem]" />
                    </Field>
                    <div className="grid grid-cols-[1.5fr_1fr] gap-2.5">
                      <Field label="Type" ai extra={probs ? percent(probs.type[draft.type]) : undefined}>
                        <SegmentedControl label="Type" value={draft.type} onChange={(type) => update({ type })} options={PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
                      </Field>
                      <Field label="Status" ai extra={probs ? percent(probs.status[draft.status]) : undefined}>
                        <SegmentedControl label="Status" value={draft.status} onChange={(s) => update({ status: s })} options={PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 items-end gap-2.5">
                      <Field label="Year" ai>
                        <Input inputMode="numeric" maxLength={4} value={draft.year} onChange={(e) => update({ year: e.target.value.replace(/\D/g, "") })} className="font-mono text-[0.78rem] md:text-[0.78rem]" />
                      </Field>
                      <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-[0.8125rem]">
                        <Checkbox checked={draft.featured} onCheckedChange={(c) => update({ featured: !!c })} />
                        Featured
                      </label>
                    </div>
                  </div>
                </div>

                <Field label="Technologies" ai extra="matched to your existing tags" className="mt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.technologies.map((t) => (
                      <span key={t.name} className="inline-flex h-7 items-center gap-1.5 rounded-lg border bg-card pr-1 pl-2.5 text-xs">
                        {t.name}
                        {t.isNew && <span className="rounded bg-primary/15 px-1 font-mono text-[0.59375rem] font-medium text-warning-strong">new</span>}
                        <button type="button" aria-label={`Remove ${t.name}`} onClick={() => update({ technologies: draft.technologies.filter((x) => x.name !== t.name) })} className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newTech.trim();
                        if (name && !draft.technologies.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
                          update({ technologies: [...draft.technologies, { name, isNew: true }] });
                        }
                        setNewTech("");
                      }}
                    >
                      <Input value={newTech} onChange={(e) => setNewTech(e.target.value)} placeholder="+ Add" aria-label="Add a technology" className="h-7 w-24 border-dashed px-2 text-xs md:text-xs" />
                    </form>
                  </div>
                </Field>

                <Field label="Description" ai extra={`${draft.description.length} / 160`} className="mt-4">
                  <Textarea value={draft.description} maxLength={300} onChange={(e) => update({ description: e.target.value })} className={cn(areaClass, "min-h-0 bg-primary/5", draft.description.length > 160 && "border-destructive/50")} />
                </Field>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Problem" ai>
                    <Textarea value={draft.problem} onChange={(e) => update({ problem: e.target.value })} className={cn(areaClass, "bg-primary/5")} />
                  </Field>
                  <Field label="Solution" ai>
                    <Textarea value={draft.solution} onChange={(e) => update({ solution: e.target.value })} className={cn(areaClass, "bg-primary/5")} />
                  </Field>
                </div>

                <Field label="Business impact" ai extra="one point per line" className="mt-4">
                  <Textarea value={draft.businessImpact} onChange={(e) => update({ businessImpact: e.target.value })} className={cn(areaClass, "bg-primary/5")} />
                </Field>

                <button type="button" onClick={() => setShowLong((v) => !v)} className="mt-4 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-[0.8125rem] font-medium hover:bg-background">
                  <i className="block size-1.5 rounded-full bg-primary" />
                  Overview · Body
                  <span className="ml-auto flex items-center gap-1 text-[0.6875rem] font-normal text-muted-foreground">
                    {showLong ? "hide" : "2 more fields"}
                    <ChevronDown className={cn("size-3.5 transition-transform", showLong && "rotate-180")} />
                  </span>
                </button>
                {showLong && (
                  <div className="mt-3 flex flex-col gap-3">
                    <Field label="Overview" ai>
                      <Textarea value={draft.overview} onChange={(e) => update({ overview: e.target.value })} className={cn(areaClass, "bg-primary/5")} />
                    </Field>
                    <Field label="Body" ai extra="paragraphs, blank line between">
                      <Textarea value={draft.body} onChange={(e) => update({ body: e.target.value })} className={cn(areaClass, "bg-primary/5")} />
                    </Field>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Preview">
                    <Input value={draft.preview ?? ""} onChange={(e) => update({ preview: e.target.value || null })} className="font-mono text-[0.75rem] md:text-[0.75rem]" />
                  </Field>
                  <Field label="Source">
                    <Input value={draft.source ?? ""} onChange={(e) => update({ source: e.target.value || null })} placeholder="GitHub URL" className="font-mono text-[0.75rem] md:text-[0.75rem]" />
                  </Field>
                  <Field label="Published date">
                    <Input
                      type="date"
                      value={draft.publishedAt.slice(0, 10)}
                      onChange={(e) => e.target.value && update({ publishedAt: new Date(`${e.target.value}T09:00:00.000Z`).toISOString() })}
                      className="font-mono text-[0.75rem] md:text-[0.75rem]"
                    />
                  </Field>
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                  <i className="block size-1.5 rounded-full bg-primary" />
                  Written from the site, the repo and your notes only. Check facts before publishing.
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function FoundItem({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2">
      {ok ? (
        <span className="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-strong">
          <Check className="size-2.75 stroke-3" />
        </span>
      ) : warn ? (
        <span className="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-warning-strong">
          <Info className="size-2.75" />
        </span>
      ) : (
        <span className="mt-px size-4.5 shrink-0 rounded-full border-[1.5px] border-dashed border-input" />
      )}
      <span className="min-w-0">{children}</span>
    </li>
  );
}
