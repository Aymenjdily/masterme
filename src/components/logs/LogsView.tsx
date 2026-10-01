"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, SquareTerminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { updatedLabel } from "@/components/monthly-cost/AppsServicesSummary";
import { LogTerminal } from "@/components/logs/LogTerminal";
import { ProjectLogList } from "@/components/logs/ProjectLogList";
import { useLogStream } from "@/components/logs/use-log-stream";
import type { LogRange, LogRow, LogsResponse, LogView, StreamLine } from "@/components/logs/log-types";

const LIVE_INFO_MAX = 200;
const REFRESH_THROTTLE_MS = 1500;

async function fetchLogs(project: string, range: LogRange): Promise<LogsResponse> {
  const res = await fetch(`/api/logs?project=${encodeURIComponent(project)}&range=${range}`);
  if (!res.ok) throw new Error("Failed to load logs");
  return res.json();
}

function Stat({
  label,
  dot,
  value,
  small,
  sub,
  tone,
}: {
  label: string;
  dot?: string;
  value: string;
  small?: string;
  sub: string;
  tone?: "neg" | "warn";
}) {
  return (
    <Card className="gap-1.5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4)]">
      <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        {dot && <i className={cn("size-1.75 rounded-full", dot)} />}
        {label}
      </p>
      <p
        className={cn(
          "truncate font-mono text-xl font-medium",
          tone === "neg" && "text-destructive-strong",
          tone === "warn" && "text-warning-strong"
        )}
      >
        {value}
        {small && <small className="ml-1 text-xs font-normal text-muted-foreground">{small}</small>}
      </p>
      <p className="truncate text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Link2;
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-[16px] border border-dashed border-input bg-background px-5 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
        <Icon className="size-[18px] text-ring" />
      </div>
      <p className="mt-3.5 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-[0.8125rem] text-muted-foreground">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-[0.8125rem] font-medium shadow-xs hover:bg-muted"
        >
          <Link2 className="size-3.5" />
          {action.label}
        </Link>
      )}
    </div>
  );
}

const toRow = (line: StreamLine): LogRow => ({ ...line, firstAt: line.at, lastAt: line.at });

function matchesView(row: LogRow, view: LogView) {
  if (view === "errors") return row.level === "error";
  if (view === "warnings") return row.level === "error" || row.level === "warn";
  if (view === "builds") return row.level === "build";
  return true;
}

export function LogsView({ initialProject }: { initialProject: string }) {
  const queryClient = useQueryClient();
  const [project, setProject] = useState(initialProject);
  const [range, setRange] = useState<LogRange>("24h");
  const [view, setView] = useState<LogView>("errors");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveInfo, setLiveInfo] = useState<LogRow[]>([]);
  // Pause freezes what's on screen; the stream keeps recording in the background.
  const [frozen, setFrozen] = useState<{ logs: LogRow[]; info: LogRow[] } | null>(null);
  const [pending, setPending] = useState(0);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.projectLogs(project, range),
    queryFn: () => fetchLogs(project, range),
    refetchInterval: 60 * 1000,
  });

  const current = project === "all" ? null : data?.projects.find((p) => p.id === project);
  const streamEnabled = !!data?.configured && (current ? current.linked : (data?.stats.linked ?? 0) > 0);

  // New saved lines refresh the list (grouped counts come from the database), at most every 1.5 s.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      queryClient.invalidateQueries({ queryKey: ["project-logs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    }, REFRESH_THROTTLE_MS);
  }, [queryClient]);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const paused = frozen !== null;
  const onLine = useCallback(
    (line: StreamLine) => {
      if (paused) setPending((n) => n + 1);
      if (line.saved) scheduleRefresh();
      else setLiveInfo((rows) => [toRow(line), ...rows].slice(0, LIVE_INFO_MAX));
    },
    [paused, scheduleRefresh]
  );
  const { state } = useLogStream(project, streamEnabled, onLine);

  // Opening /logs marks errors as seen (the sidebar badge); leaving does too.
  useEffect(() => {
    const markSeen = () =>
      fetch("/api/logs/seen", { method: "POST", keepalive: true })
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.logsUnseen }))
        .catch(() => {});
    markSeen();
    return () => {
      markSeen();
    };
  }, [queryClient]);

  const selectProject = (id: string) => {
    setProject(id);
    setSelectedId(null);
    setLiveInfo([]);
    setFrozen(null);
    setPending(0);
    window.history.replaceState(null, "", id === "all" ? "/logs" : `/logs?project=${id}`);
  };

  const togglePause = () => {
    if (frozen) {
      setFrozen(null);
      setPending(0);
      queryClient.invalidateQueries({ queryKey: ["project-logs"] });
    } else {
      setFrozen({ logs: data?.logs ?? [], info: liveInfo });
    }
  };

  const allRows = useMemo(() => {
    const logs = frozen?.logs ?? data?.logs ?? [];
    const info = view === "all" ? (frozen?.info ?? liveInfo) : [];
    return [...logs, ...info].sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
  }, [frozen, data, liveInfo, view]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(
      (row) =>
        matchesView(row, view) &&
        (!q ||
          row.message.toLowerCase().includes(q) ||
          (row.path ?? "").toLowerCase().includes(q) ||
          (row.commitMessage ?? "").toLowerCase().includes(q))
    );
  }, [allRows, view, query]);

  const stats = data?.stats;
  const title = current ? (current.vercelProjectName ?? current.title) : "all projects";
  const watching = current ? 1 : (stats?.linked ?? 0);

  let emptyText: React.ReactNode = "No lines match this filter.";
  if (allRows.length === 0) {
    emptyText = current ? (
      <>
        <b className="block text-[0.8125rem] font-medium text-terminal-ok">✓ All quiet on {title}</b>
        No errors or warnings in the last {range === "24h" ? "24 h" : "7 days"}.
      </>
    ) : (
      <>
        <b className="block text-[0.8125rem] font-medium text-terminal-ok">Nothing captured yet</b>
        Logs are recorded while this page is open. Keep it in a tab while you work; new errors land here as they happen.
      </>
    );
  } else if (rows.length === 0 && view === "errors") {
    emptyText = (
      <>
        <b className="block text-[0.8125rem] font-medium text-terminal-ok">✓ No errors</b>
        Switch to + Warnings, Builds or All to see the rest.
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Errors, warnings and builds from your projects on Vercel, live while this page is open.
          </p>
        </div>
        <div className="flex gap-2">
          {streamEnabled && (
            <span
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-[10px] border px-3.5 font-mono text-xs font-medium",
                state === "streaming"
                  ? "border-success/25 bg-success/10 text-success-strong"
                  : "border-primary/30 bg-primary/10 text-warning-strong"
              )}
            >
              <i
                className={cn(
                  "size-1.75 rounded-full ring-4",
                  state === "streaming" ? "bg-success ring-success/20" : "animate-pulse bg-primary ring-primary/20"
                )}
              />
              {state === "streaming" ? `Live · watching ${watching} ${watching === 1 ? "project" : "projects"}` : "Connecting…"}
            </span>
          )}
          {current && data?.vercelLinks[current.id] && (
            <a
              href={data.vercelLinks[current.id]!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border bg-card px-4 text-sm font-medium shadow-xs hover:bg-muted"
            >
              <ExternalLink className="size-3.5" />
              Open Vercel
            </a>
          )}
        </div>
      </div>

      {isError && <p className="text-sm text-destructive-strong">Failed to load logs.</p>}

      {isPending ? (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[20px]" />
            ))}
          </div>
          <Skeleton className="h-[640px] rounded-[20px]" />
        </>
      ) : data && !data.configured ? (
        <EmptyCard
          icon={SquareTerminal}
          title="Vercel isn't connected"
          description="Add VERCEL_API_TOKEN to the server environment (.env.local and Vercel's env vars), then reload."
        />
      ) : data && stats ? (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Stat
              label="Errors · 24 h"
              dot="bg-destructive"
              value={String(stats.errors)}
              small={stats.errors ? `in ${stats.errorProjects} ${stats.errorProjects === 1 ? "project" : "projects"}` : undefined}
              sub={stats.newErrors ? `${stats.newErrors} new since you last looked` : "nothing new since you last looked"}
              tone={stats.errors ? "neg" : undefined}
            />
            <Stat
              label="Warnings · 24 h"
              dot="bg-primary"
              value={String(stats.warnings)}
              sub="4xx responses, slow or noisy functions"
              tone={stats.warnings ? "warn" : undefined}
            />
            <Stat
              label="Builds · 24 h"
              dot="bg-success"
              value={String(stats.builds)}
              small={stats.failedBuilds ? `${stats.failedBuilds} failed` : undefined}
              sub={
                stats.lastFailed
                  ? `${stats.lastFailed.title} · ${new Date(stats.lastFailed.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : "production deploys"
              }
            />
            <Stat
              label="Last log received"
              value={stats.lastLogAt ? updatedLabel(stats.lastLogAt) : "—"}
              sub={streamEnabled ? `${state === "streaming" ? "streaming" : "connecting"} · ${stats.linked} linked` : `${stats.linked} linked`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <ProjectLogList projects={data.projects} selected={project} onSelect={selectProject} />

            {stats.linked === 0 ? (
              <EmptyCard
                icon={Link2}
                title="No project is linked to Vercel yet"
                description="Edit a project and pick its Vercel project under Hosting to see its logs here."
                action={{ label: "Link a Vercel project", href: "/projects" }}
              />
            ) : current && !current.linked ? (
              <EmptyCard
                icon={Link2}
                title={`${current.title} isn't linked to Vercel`}
                description="Pick its Vercel project in Edit project to see its logs."
                action={{ label: "Link Vercel project", href: "/projects" }}
              />
            ) : (
              <LogTerminal
                title={title}
                rows={rows}
                total={allRows.length}
                view={view}
                onView={setView}
                query={query}
                onQuery={setQuery}
                range={range}
                onRange={() => setRange((r) => (r === "24h" ? "7d" : "24h"))}
                paused={paused}
                onPause={togglePause}
                pending={pending}
                state={state}
                linked={watching}
                showProject={!current}
                selectedId={selectedId}
                onSelect={setSelectedId}
                vercelLinks={data.vercelLinks}
                emptyText={emptyText}
              />
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
