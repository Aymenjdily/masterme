"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { selectClassName } from "@/components/forms/MonthlyCostForm";
import type { LogProject } from "@/components/logs/log-types";

function dotClass(p: LogProject) {
  return p.errors > 0 ? "bg-destructive" : p.warnings > 0 ? "bg-primary" : "bg-success";
}

function CountChip({ project }: { project: LogProject }) {
  if (project.errors > 0) {
    return <span className="rounded-md bg-destructive/10 px-1.75 py-0.5 font-mono text-[0.72rem] font-medium text-destructive-strong">{project.errors}</span>;
  }
  if (project.warnings > 0) {
    return <span className="rounded-md bg-primary/15 px-1.75 py-0.5 font-mono text-[0.72rem] font-medium text-warning-strong">{project.warnings}</span>;
  }
  return <span className="font-mono text-[0.72rem] font-medium text-success-strong">quiet</span>;
}

const rowClass =
  "relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.25 text-left text-[0.84rem] transition-colors hover:bg-background";
const activeClass =
  "bg-background before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary before:content-['']";

export function ProjectLogList({
  projects,
  selected,
  onSelect,
}: {
  projects: LogProject[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const linked = projects.filter((p) => p.linked);
  const unlinked = projects.filter((p) => !p.linked);
  const totalErrors = linked.reduce((sum, p) => sum + p.errors, 0);

  return (
    <>
      {/* Small screens: a select above the terminal */}
      <select
        aria-label="Project"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className={cn(selectClassName, "lg:hidden")}
      >
        <option value="all">All projects</option>
        {linked.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} {p.errors ? `· ${p.errors} errors` : p.warnings ? `· ${p.warnings} warnings` : "· quiet"}
          </option>
        ))}
        {unlinked.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title} · not linked
          </option>
        ))}
      </select>

      <Card className="hidden gap-0 self-start rounded-[20px] p-3 lg:flex">
        <div className="flex items-center justify-between px-2 pt-1.5 pb-2.5">
          <h2 className="text-sm font-semibold">Projects</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
            {linked.length} linked
          </span>
        </div>
        <button type="button" onClick={() => onSelect("all")} className={cn(rowClass, selected === "all" && activeClass)}>
          <span className="size-2 shrink-0 rounded-full bg-muted-foreground" />
          <span className="flex-1">All projects</span>
          {totalErrors > 0 && (
            <span className="rounded-md bg-destructive/10 px-1.75 py-0.5 font-mono text-[0.72rem] font-medium text-destructive-strong">{totalErrors}</span>
          )}
        </button>
        {linked.map((p) => (
          <button key={p.id} type="button" onClick={() => onSelect(p.id)} className={cn(rowClass, selected === p.id && activeClass)}>
            <span className={cn("size-2 shrink-0 rounded-full", dotClass(p))} />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{p.title}</span>
              {p.vercelProjectName && (
                <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">{p.vercelProjectName}</span>
              )}
            </span>
            <CountChip project={p} />
          </button>
        ))}

        {unlinked.length > 0 && (
          <>
            <p className="mt-2 border-t px-2.5 pt-3.5 pb-1.5 font-mono text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground/80 uppercase">
              Not linked
            </p>
            {unlinked.map((p) => (
              <div key={p.id} className={cn(rowClass, "cursor-default text-muted-foreground hover:bg-transparent")}>
                <span className="size-2 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground/60" />
                <button type="button" onClick={() => onSelect(p.id)} className="min-w-0 flex-1 cursor-pointer truncate text-left hover:text-foreground">
                  {p.title}
                </button>
                <Link href="/projects" className="text-xs hover:text-foreground">
                  Link
                </Link>
              </div>
            ))}
          </>
        )}
      </Card>
    </>
  );
}
