"use client";

import { useEffect, useRef, useState } from "react";
import type { StreamLine, StreamState } from "@/components/logs/log-types";

/**
 * Holds one EventSource on /api/logs/stream while `enabled`. The server closes the stream every few
 * minutes (function limit) and the browser reconnects on its own; each line goes to `onLine`.
 */
export function useLogStream(project: string, enabled: boolean, onLine: (line: StreamLine) => void) {
  const [state, setState] = useState<StreamState>("connecting");
  const [since, setSince] = useState<string | null>(null);
  const onLineRef = useRef(onLine);

  useEffect(() => {
    onLineRef.current = onLine;
  }, [onLine]);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`/api/logs/stream?project=${encodeURIComponent(project)}`);
    source.addEventListener("ready", (e) => {
      setState("streaming");
      setSince((prev) => prev ?? (JSON.parse((e as MessageEvent).data).at as string));
    });
    source.addEventListener("line", (e) => onLineRef.current(JSON.parse((e as MessageEvent).data)));
    source.addEventListener("end", () => setState("reconnecting"));
    source.onerror = () => setState(source.readyState === EventSource.CLOSED ? "off" : "reconnecting");
    return () => {
      source.close();
      setState("connecting");
    };
  }, [project, enabled]);

  return { state: enabled ? state : ("off" as const), since };
}
