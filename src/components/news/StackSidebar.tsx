"use client";

import Link from "next/link";
import { Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { StackLogo } from "@/components/news/StackLogo";

function StackItem({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex h-9.5 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[0.84rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
        active &&
          "bg-background font-medium text-foreground before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary before:content-['']"
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-card">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={cn("font-mono text-[0.71875rem] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}

export function StackSidebar({
  skills,
  activeSkill,
  onSelect,
  counts,
  total,
}: {
  skills: string[];
  activeSkill: string | null;
  onSelect: (skill: string | null) => void;
  counts: Record<string, number>;
  total: number;
}) {
  return (
    <nav aria-label="Your stack" className="rounded-[20px] border bg-card px-3 py-4 shadow-card">
      <div className="flex items-center justify-between px-1.5 pb-2.5">
        <h2 className="text-sm font-semibold">Your stack</h2>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {skills.length} skill{skills.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <StackItem
          label="All"
          icon={<Layers className="size-3.5 text-muted-foreground" />}
          count={total}
          active={activeSkill === null}
          onClick={() => onSelect(null)}
        />
        {skills.map((skill) => (
          <StackItem
            key={skill}
            label={skill}
            icon={<StackLogo skill={skill} />}
            count={counts[skill] ?? 0}
            active={activeSkill === skill}
            onClick={() => onSelect(skill)}
          />
        ))}
      </div>
      <Link
        href="/settings"
        className="mx-1.5 mt-2.5 flex items-center gap-2 border-t pt-3 text-[0.8125rem] text-info-strong hover:underline"
      >
        <Settings className="size-3.5" />
        Edit stack in Settings
      </Link>
    </nav>
  );
}
