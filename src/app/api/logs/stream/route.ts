import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productionDeployments, runtimeLogs, vercelConfigured } from "@/lib/vercel";
import { classify, pruneLogs, saveLogLine } from "@/lib/project-logs";

// Live logs for /logs as server-sent events. For each linked project (or the selected one) it follows
// the current production deployment's runtime-logs stream from Vercel, saves errors and warnings,
// and forwards every line. Vercel only streams new lines (Hobby has no log drains), so logs are
// recorded while a Logs page is open. The stream closes before the function limit; EventSource reconnects.
export const maxDuration = 300;

const SESSION_MS = 240 * 1000;
const HEARTBEAT_MS = 20 * 1000;
const RETRY_MS = 3000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!vercelConfigured()) {
    return Response.json({ error: "VERCEL_API_TOKEN not configured" }, { status: 503 });
  }
  const userId = session.user.id;
  const selected = new URL(request.url).searchParams.get("project") ?? "all";

  // Only the signed-in user's own linked projects are ever streamed.
  const projects = await prisma.project.findMany({
    where: { userId, vercelProjectId: { not: null }, ...(selected === "all" ? {} : { id: selected }) },
    select: { id: true, title: true, vercelProjectId: true, vercelProjectName: true },
  });
  await pruneLogs(userId);

  const encoder = new TextEncoder();
  const stop = new AbortController();
  request.signal.addEventListener("abort", () => stop.abort());

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
          stop.abort();
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const ending = setTimeout(() => stop.abort(), SESSION_MS);
      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      write(`retry: ${RETRY_MS}\n\n`);
      send("ready", { projects: projects.length, at: new Date().toISOString() });

      await Promise.all(
        projects.map(async (p) => {
          const vercelProjectId = p.vercelProjectId!;
          while (!stop.signal.aborted) {
            try {
              // Re-checked on every (re)connect, so a new production deploy is picked up.
              const [deployment] = await productionDeployments(vercelProjectId, 1);
              if (!deployment || deployment.state !== "READY") {
                send("status", { projectId: p.id, state: deployment?.state ?? "NONE" });
                await sleep(30 * 1000, stop.signal);
                continue;
              }
              send("watching", { projectId: p.id, deploymentId: deployment.id });
              for await (const line of runtimeLogs(vercelProjectId, deployment.id, stop.signal)) {
                const level = classify(line);
                const saved = level === "info" ? null : await saveLogLine(userId, p.id, deployment.id, line, level);
                send("line", {
                  id: saved?.id ?? `live-${line.rowId}`,
                  saved: !!saved,
                  count: saved?.count ?? 1,
                  projectId: p.id,
                  projectTitle: p.title,
                  vercelProjectName: p.vercelProjectName,
                  level,
                  method: line.requestMethod,
                  path: line.requestPath?.split("?")[0] ?? null,
                  status: line.responseStatusCode,
                  message: line.message.slice(0, 4000),
                  source: line.source,
                  deploymentId: deployment.id,
                  at: new Date(line.timestampInMs).toISOString(),
                });
              }
            } catch (err) {
              if (stop.signal.aborted) break;
              console.error(`[api/logs/stream] ${p.title}:`, err);
              send("status", { projectId: p.id, state: "RETRYING" });
            }
            await sleep(RETRY_MS, stop.signal);
          }
        })
      );

      clearTimeout(ending);
      clearInterval(heartbeat);
      send("end", { reconnect: !request.signal.aborted });
      if (!closed) {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
    cancel() {
      stop.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
