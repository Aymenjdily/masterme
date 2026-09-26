import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TechNews } from "@/types";
import { tintAt } from "@/components/portfolio/shared";
import { StackLogo } from "@/components/news/StackLogo";

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Today", "Yesterday", "Earlier this week" (last 7 days), then "September 2026". */
export function groupLabel(iso?: string, now = new Date()) {
  if (!iso) return "Undated";
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Earlier this week";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-US", { month: "short" })}`;
}

function RepoRow({ item }: { item: TechNews }) {
  const [owner, ...rest] = item.title.split("/");
  const name = rest.join("/");
  const hash = [...owner].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-start gap-3.5 rounded-[14px] p-3 transition-colors hover:bg-background">
      <span className={cn("flex size-10 items-center justify-center rounded-[11px] text-[0.8125rem] font-bold", tintAt(hash))}>
        {owner.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="group/link inline-flex max-w-full items-center gap-1.5 font-mono text-[0.84rem] outline-none hover:underline focus-visible:underline"
        >
          {name ? (
            <>
              <span className="truncate text-muted-foreground">{owner} /</span>
              <span className="truncate font-medium text-foreground">{name}</span>
            </>
          ) : (
            <span className="truncate font-medium text-foreground">{item.title}</span>
          )}
          <ExternalLink className="size-3.25 shrink-0 text-muted-foreground group-hover/link:text-foreground" />
        </a>
        {item.description && (
          <p className="mt-1 line-clamp-2 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">{item.description}</p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-5.5 items-center gap-1.5 rounded-md bg-muted px-2 font-mono text-[0.6875rem] text-foreground"
              >
                <StackLogo skill={tag} className="size-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {item.publishedDate && (
        <div className="text-right font-mono whitespace-nowrap">
          <p className="text-xs font-medium">{timeAgo(item.publishedDate)}</p>
          <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{shortDate(item.publishedDate)}</p>
        </div>
      )}
    </li>
  );
}

/** Feed grouped by last update. Items arrive newest first, so groups come out in order. */
export function TechNewsList({ items }: { items: TechNews[] }) {
  const groups: { label: string; items: TechNews[] }[] = [];
  for (const item of items) {
    const label = groupLabel(item.publishedDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="flex items-center gap-2.5 px-3 pt-3.5 pb-1.5 font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase after:h-px after:flex-1 after:bg-border after:content-['']">
            {group.label}
          </h3>
          <ul>
            {group.items.map((item) => (
              <RepoRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
