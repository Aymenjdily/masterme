"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BlogPostRow } from "@/lib/sanity";

export const blogPostsKey = ["blog-posts"] as const;

type PostsResponse = { configured: boolean; count: number; posts: BlogPostRow[]; studioUrl: string | null };

const STATUS: Record<BlogPostRow["status"], { label: string; className: string }> = {
  published: { label: "Published", className: "bg-success/15 text-success-strong" },
  draft: { label: "Draft", className: "bg-primary/15 text-warning-strong" },
  "no-date": { label: "No date", className: "bg-muted text-muted-foreground" },
};

function postDate(row: BlogPostRow) {
  if (!row.date) return "no date";
  const d = new Date(row.date);
  const today = new Date().toDateString() === d.toDateString();
  if (row.status === "draft") return today ? "today · not published" : "not published";
  if (row.status === "no-date") return "no publish date";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Latest posts from the Sanity blog, with a link to the AI writer. */
export function BlogCard() {
  const { data, isPending, isError } = useQuery({
    queryKey: blogPostsKey,
    queryFn: async (): Promise<PostsResponse> => {
      const res = await fetch("/api/blog/posts");
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
  });

  return (
    <Card className="gap-0 rounded-[20px] px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[0.9375rem] font-semibold">Blog</h2>
          {data?.configured && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
              {data.count}
            </span>
          )}
        </div>
        {data?.configured && (
          <Button size="sm" nativeButton={false} render={<Link href="/portfolio/blog/new" />} className="cursor-pointer">
            <Sparkles />
            Write with AI
          </Button>
        )}
      </div>

      {isPending && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <p className="text-sm text-destructive-strong">Couldn&apos;t reach Sanity.</p>}

      {data && !data.configured && (
        <p className="rounded-xl border border-dashed bg-background px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
          Connect your Sanity blog: add <code className="font-mono text-xs">NEXT_PUBLIC_SANITY_PROJECT_ID</code>,{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SANITY_DATASET</code> and{" "}
          <code className="font-mono text-xs">SANITY_API_WRITE_TOKEN</code> to <code className="font-mono text-xs">.env.local</code>.
        </p>
      )}

      {data?.configured && (
        <>
          <ul>
            {data.posts.map((post) => (
              <li key={post.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84rem] font-medium">{post.title}</p>
                  <p className="font-mono text-[0.6875rem] text-muted-foreground">{postDate(post)}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.65625rem] font-medium", STATUS[post.status].className)}>
                  {STATUS[post.status].label}
                </span>
                <a
                  href={post.studioUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${post.title} in Sanity Studio`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
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
              <a href={data.studioUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-info-strong hover:underline">
                Open Studio →
              </a>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
