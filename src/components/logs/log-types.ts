export type LogLevel = "error" | "warn" | "build" | "info";

/** A saved row from /api/logs, or a live line from /api/logs/stream. */
export type LogRow = {
  id: string;
  projectId: string;
  projectTitle: string;
  vercelProjectName: string | null;
  level: LogLevel;
  method: string | null;
  path: string | null;
  status: number | null;
  message: string;
  source: string | null;
  deploymentId: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
  buildState?: string | null;
  commitMessage?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  durationS?: number | null;
};

export type LogProject = {
  id: string;
  title: string;
  vercelProjectName: string | null;
  linked: boolean;
  errors: number;
  warnings: number;
};

export type LogsResponse = {
  configured: boolean;
  projects: LogProject[];
  logs: LogRow[];
  stats: {
    errors: number;
    errorProjects: number;
    newErrors: number;
    warnings: number;
    builds: number;
    failedBuilds: number;
    lastFailed: { title: string; at: string } | null;
    lastLogAt: string | null;
    linked: number;
  };
  vercelLinks: Record<string, string | null>;
};

export type LogView = "errors" | "warnings" | "builds" | "all";
export type LogRange = "24h" | "7d";
export type StreamState = "off" | "connecting" | "streaming" | "reconnecting";

/** A line event from /api/logs/stream. */
export type StreamLine = Omit<LogRow, "firstAt" | "lastAt"> & { saved: boolean; at: string };
