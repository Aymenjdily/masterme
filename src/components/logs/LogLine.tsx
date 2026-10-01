"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogRow } from "@/components/logs/log-types";

const LEVEL_LABEL: Record<LogRow["level"], string> = { error: "ERROR", warn: "WARN", build: "BUILD", info: "INFO" };

const levelText = (row: LogRow) =>
  row.level === "error" || (row.level === "build" && row.buildState === "ERROR")
    ? "text-terminal-error"
    : row.level === "warn" || (row.level === "build" && row.buildState !== "READY")
      ? "text-terminal-warn"
      : row.level === "build"
        ? "text-terminal-ok"
        : "text-terminal-info";

export const terminalButtonClass =
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-terminal-line bg-white/5 px-2.5 font-mono text-xs font-medium text-terminal-foreground transition-colors hover:bg-white/10 [&_svg]:size-3.5";

export function timeOf(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleTimeString("en-GB", { hour12: false })}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

const shortTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function duration(seconds: number) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function buildSummary(row: LogRow) {
  const state = row.buildState === "READY" ? "Ready" : row.buildState === "ERROR" ? "Failed" : (row.buildState ?? "Unknown").toLowerCase();
  return [state, "production", row.durationS ? duration(row.durationS) : null, row.commitMessage ? `"${row.commitMessage}"` : null]
    .filter(Boolean)
    .join(" · ");
}

export function LogLine({
  row,
  showProject,
  selected,
  onSelect,
}: {
  row: LogRow;
  showProject: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const isBuild = row.level === "build";
  const firstLine = row.message.split("\n")[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={selected}
      className={cn(
        "grid w-full cursor-pointer items-center gap-3 border-l-2 border-transparent px-4.5 py-1.75 text-left font-mono text-[0.78rem] text-terminal-foreground hover:bg-white/[0.03]",
        showProject
          ? "grid-cols-[88px_48px_32px_minmax(0,110px)_minmax(0,190px)_minmax(0,1fr)_auto]"
          : "grid-cols-[88px_48px_32px_minmax(0,210px)_minmax(0,1fr)_auto]",
        "max-md:grid-cols-[72px_44px_minmax(0,1fr)_auto]",
        selected && row.level === "error" && "border-l-terminal-error bg-terminal-error/[0.07]",
        selected && row.level !== "error" && "border-l-terminal-dim bg-white/[0.04]"
      )}
    >
      <span className="text-terminal-dim max-md:text-[0.7rem]">{timeOf(row.lastAt).slice(0, 8)}<span className="max-md:hidden">{timeOf(row.lastAt).slice(8)}</span></span>
      <span className={cn("text-[0.6875rem] font-semibold tracking-[0.04em]", levelText(row))}>{LEVEL_LABEL[row.level]}</span>
      <span className={cn("font-medium max-md:hidden", levelText(row))}>
        {isBuild ? (row.buildState === "READY" ? "✓" : row.buildState === "ERROR" ? "✗" : "…") : (row.status ?? "")}
      </span>
      {showProject && <span className="truncate text-terminal-dim max-md:hidden">{row.vercelProjectName ?? row.projectTitle}</span>}
      <span className="truncate text-[#b8bdcc] max-md:hidden">
        {isBuild ? (
          <>
            <span className="mr-1.5 text-terminal-dim">{row.branch ?? "—"}</span>
            {row.commitSha?.slice(0, 7)}
          </>
        ) : (
          <>
            {row.method && <span className="mr-1.5 text-terminal-dim">{row.method}</span>}
            {row.path ?? "—"}
          </>
        )}
      </span>
      <span className="truncate">{isBuild ? buildSummary(row) : firstLine}</span>
      <span className={cn("rounded-[5px] bg-white/5 px-1.75 py-0.5 text-[0.6875rem] text-terminal-dim", (isBuild || row.level === "info") && "invisible")}>
        ×{row.count}
      </span>
    </button>
  );
}

export function LogDetail({ row, vercelLink }: { row: LogRow; vercelLink: string | null }) {
  const [copied, setCopied] = useState(false);
  const [first, ...rest] = row.message.split("\n");
  const copy = async () => {
    await navigator.clipboard.writeText(row.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-4.5 mb-2 overflow-hidden rounded-xl border border-terminal-error/20 bg-[#0e0f14]">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-terminal-line px-3.5 py-2.5 font-mono text-[0.72rem] whitespace-nowrap text-terminal-dim">
        {row.path && (
          <span>
            {row.method ?? "fn"} <b className="font-medium text-terminal-foreground">{row.path}</b>
          </span>
        )}
        {row.source && <span>{row.source}</span>}
        {row.status && <span>status <b className="font-medium text-terminal-foreground">{row.status}</b></span>}
        <span>
          first <b className="font-medium text-terminal-foreground">{shortTime(row.firstAt)}</b> · last{" "}
          <b className="font-medium text-terminal-foreground">{shortTime(row.lastAt)}</b>
        </span>
        <span className="ml-auto flex gap-1.5">
          <button type="button" onClick={copy} className={terminalButtonClass}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </button>
          {vercelLink && (
            <a href={vercelLink} target="_blank" rel="noreferrer" className={terminalButtonClass}>
              <ExternalLink />
              Vercel
            </a>
          )}
        </span>
      </div>
      <pre className="max-h-72 overflow-auto px-3.5 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#c9cdd9]">
        <span className={row.level === "error" ? "text-terminal-error" : row.level === "warn" ? "text-terminal-warn" : ""}>{first}</span>
        {rest.length > 0 && <span className="text-terminal-dim">{"\n" + rest.join("\n")}</span>}
      </pre>
    </div>
  );
}
