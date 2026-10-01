"use client";

import { Fragment, useEffect, useState } from "react";
import {
  CalendarDays,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LogRange,
  LogRow,
  LogView,
  StreamState,
} from "@/components/logs/log-types";
import {
  LogDetail,
  LogLine,
  terminalButtonClass,
} from "@/components/logs/LogLine";

const VIEWS: { value: LogView; label: string; dot?: string }[] = [
  { value: "errors", label: "Errors", dot: "bg-terminal-error" },
  { value: "warnings", label: "+ Warnings", dot: "bg-terminal-warn" },
  { value: "builds", label: "Builds" },
  { value: "all", label: "All" },
];

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (d.toDateString() === today.toDateString()) return `Today · ${date}`;
  if (d.toDateString() === yesterday.toDateString())
    return `Yesterday · ${date}`;
  return date;
}

function Footer({
  state,
  paused,
  pending,
  linked,
  shown,
  total,
  onResume,
}: {
  state: StreamState;
  paused: boolean;
  pending: number;
  linked: number;
  shown: number;
  total: number;
  onResume: () => void;
}) {
  const base =
    "flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-terminal-line px-4.5 py-2.5 font-mono text-[0.72rem] text-terminal-dim";
  if (paused) {
    return (
      <div className={base}>
        <span className="text-terminal-warn">❚❚ paused</span>
        <span>still recording in the background</span>
        <button
          type="button"
          onClick={onResume}
          className="ml-auto cursor-pointer text-terminal-foreground hover:underline"
        >
          {pending} new {pending === 1 ? "line" : "lines"} · Resume
        </button>
      </div>
    );
  }
  return (
    <div className={base}>
      {state === "streaming" && (
        <span className="text-terminal-ok">● streaming</span>
      )}
      {state === "connecting" && (
        <span className="text-terminal-dim">● connecting…</span>
      )}
      {state === "reconnecting" && (
        <span className="text-terminal-error">● reconnecting…</span>
      )}
      <span>
        {linked} {linked === 1 ? "project" : "projects"} · showing {shown} of{" "}
        {total} · grouped by message
      </span>
      {state === "streaming" && (
        <span className="ml-auto">
          waiting for new lines
          <span className="ml-1 inline-block h-3.75 w-2 animate-pulse bg-terminal-ok align-[-3px]" />
        </span>
      )}
    </div>
  );
}

export function LogTerminal({
  title,
  rows,
  total,
  view,
  onView,
  query,
  onQuery,
  range,
  onRange,
  paused,
  onPause,
  pending,
  state,
  linked,
  showProject,
  selectedId,
  onSelect,
  vercelLinks,
  emptyText,
}: {
  title: string;
  rows: LogRow[];
  total: number;
  view: LogView;
  onView: (view: LogView) => void;
  query: string;
  onQuery: (q: string) => void;
  range: LogRange;
  onRange: () => void;
  paused: boolean;
  onPause: () => void;
  pending: number;
  state: StreamState;
  linked: number;
  showProject: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  vercelLinks: Record<string, string | null>;
  emptyText: React.ReactNode;
}) {
  // Full screen keeps the same component (and stream, filters, open line); Esc closes it.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setExpanded(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [expanded]);

  return (
    <>
      {expanded && (
        <div
          aria-hidden
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-40 bg-[#0e0f14]/60 backdrop-blur-[2px]"
        />
      )}
      <section
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? `Logs · ${title}` : undefined}
        className={cn(
          "flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#0e0f14] bg-terminal shadow-[0_12px_32px_#1b1e2933]",
          expanded ? "fixed inset-2 z-50 sm:inset-6" : "min-h-[640px]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b border-terminal-line bg-terminal-bar px-3.5 py-3">
          <span className="mr-1 flex gap-1.5" aria-hidden>
            <i className="size-2.5 rounded-full bg-white/12" />
            <i className="size-2.5 rounded-full bg-white/12" />
            <i className="size-2.5 rounded-full bg-white/12" />
          </span>
          <span className="truncate font-mono text-[0.8125rem] font-medium text-terminal-foreground">
            {title}{" "}
            <span className="font-normal text-terminal-dim">· production</span>
          </span>
          <button
            type="button"
            onClick={onPause}
            className={cn(terminalButtonClass, "ml-auto")}
          >
            {paused ? <Play /> : <Pause />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Exit full screen" : "Full screen"}
            title={expanded ? "Exit full screen (Esc)" : "Full screen"}
            className={cn(terminalButtonClass, "px-2")}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </button>
          <span className="basis-full" />
          <div
            role="tablist"
            aria-label="Log level"
            className="inline-flex gap-0.5 rounded-[9px] bg-white/5 p-0.75"
          >
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                onClick={() => onView(v.value)}
                className={cn(
                  "flex h-6.5 cursor-pointer items-center gap-1.5 rounded-[7px] px-2.75 font-mono text-xs font-medium text-terminal-dim",
                  view === v.value && "bg-white/10 text-white",
                )}
              >
                {v.dot && <i className={cn("size-1.5 rounded-full", v.dot)} />}
                {v.label}
              </button>
            ))}
          </div>
          <label className="flex h-8 min-w-44 flex-1 items-center gap-2 rounded-[9px] border border-terminal-line bg-white/5 px-2.5 font-mono text-xs text-terminal-dim">
            <Search className="size-3.5 shrink-0" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Filter path or message…"
              aria-label="Filter path or message"
              className="min-w-0 flex-1 bg-transparent text-terminal-foreground outline-none placeholder:text-terminal-dim"
            />
          </label>
          <button
            type="button"
            onClick={onRange}
            className={terminalButtonClass}
            title="Switch time range"
          >
            <CalendarDays />
            {range === "24h" ? "Last 24 h" : "Last 7 days"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center font-mono text-[0.78rem] leading-relaxed text-terminal-dim">
              {emptyText}
            </div>
          ) : (
            rows.map((row, i) => {
              const day = dayLabel(row.lastAt);
              const showDay = i === 0 || dayLabel(rows[i - 1].lastAt) !== day;
              return (
                <Fragment key={row.id}>
                  {showDay && (
                    <div className="flex items-center gap-2.5 px-4.5 pt-2.5 pb-1.5 font-mono text-[0.65rem] font-medium tracking-[0.12em] text-terminal-dim uppercase after:h-px after:flex-1 after:bg-terminal-line">
                      {day}
                    </div>
                  )}
                  <LogLine
                    row={row}
                    showProject={showProject}
                    selected={selectedId === row.id}
                    onSelect={() =>
                      onSelect(selectedId === row.id ? null : row.id)
                    }
                  />
                  {selectedId === row.id && (
                    <LogDetail
                      row={row}
                      vercelLink={vercelLinks[row.projectId] ?? null}
                    />
                  )}
                </Fragment>
              );
            })
          )}
        </div>

        <Footer
          state={state}
          paused={paused}
          pending={pending}
          linked={linked}
          shown={rows.length}
          total={total}
          onResume={onPause}
        />
      </section>
    </>
  );
}
