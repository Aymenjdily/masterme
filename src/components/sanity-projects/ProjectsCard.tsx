"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectRow } from "@/lib/sanity";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/ai/sanity-project-kinds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const sanityProjectsKey = ["sanity-projects"] as const;

type ProjectsResponse = { configured: boolean; count: number; projects: ProjectRow[]; studioUrl: string | null };

const TYPE_TONE: Record<string, string> = {
  "client-work": "bg-info/12 text-info-strong",
  product: "bg-special/12 text-special-strong",
  project: "bg-muted text-muted-foreground",
};

/** Latest portfolio projects from Sanity, with "Add from link". */
export function ProjectsCard() {
  const { data, isPending, isError } = useQuery({
    queryKey: sanityProjectsKey,
    queryFn: async (): Promise<ProjectsResponse> => {
      const res = await fetch("/api/sanity/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  if (data && !data.configured) return null;

  return (
    <Card className="gap-0 rounded-[20px] px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[0.9375rem] font-semibold">Portfolio projects</h2>
          {data && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">{data.count}</span>
          )}
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/portfolio/projects/new" />} className="cursor-pointer">
          <Link2 />
          Add from link
        </Button>
      </div>

      {isPending && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive-strong">Couldn&apos;t reach Sanity.</p>}

      {data && (
        <>
          <ul>
            {data.projects.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="h-8 w-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-8 w-12 shrink-0 rounded-md bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84rem] font-medium">{p.title}</p>
                  <p className="font-mono text-[0.6875rem] text-muted-foreground">
                    {p.year ?? "—"}
                    {p.draft ? " · draft" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {p.draft ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[0.65625rem] font-medium text-warning-strong">Draft</span>
                  ) : (
                    <>
                      {p.type && (
                        <span className={cn("rounded-full px-2 py-0.5 font-mono text-[0.65625rem] font-medium", TYPE_TONE[p.type])}>
                          {TYPE_LABEL[p.type]}
                        </span>
                      )}
                      {p.status && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-mono text-[0.65625rem] font-medium",
                            p.status === "live" ? "bg-success/15 text-success-strong" : "bg-primary/15 text-warning-strong"
                          )}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <a href={p.studioUrl} target="_blank" rel="noreferrer" aria-label={`Open ${p.title} in Sanity Studio`} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between border-t pt-3">
            <span className="flex items-center gap-1.5 font-mono text-[0.65625rem] font-medium text-success-strong">
              <span className="size-1.5 rounded-full bg-success ring-3 ring-success/20" />
              Connected to Sanity
            </span>
            {data.studioUrl && (
              <a href={`${data.studioUrl.replace(/\/$/, "")}/structure/project`} target="_blank" rel="noreferrer" className="text-xs font-medium text-info-strong hover:underline">
                Open Studio →
              </a>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
