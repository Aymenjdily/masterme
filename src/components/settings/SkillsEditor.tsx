"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Layers, Plus, Radar, X } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StackLogo } from "@/components/news/StackLogo";
import { SettingsCard } from "@/components/settings/SettingsCard";

// Quick one-click suggestions for a typical full-stack web profile; any free-text skill still works.
const SUGGESTED_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Tailwind CSS",
  "Prisma",
  "PostgreSQL",
  "Git",
  "Docker",
  "HTML",
  "CSS",
];

async function fetchSkills(): Promise<{ skills: string[] }> {
  const res = await fetch("/api/user/skills");
  if (!res.ok) throw new Error("Failed to load skills");
  return res.json();
}

async function saveSkills(skills: string[]) {
  const res = await fetch("/api/user/skills", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skills }),
  });
  if (!res.ok) throw new Error("Failed to save skills");
  return res.json();
}

const has = (skills: string[], skill: string) => skills.some((s) => s.toLowerCase() === skill.toLowerCase());

export function SkillsEditor() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data, isPending, isError } = useQuery({ queryKey: queryKeys.userSkills, queryFn: fetchSkills });

  // Optimistic so chips appear/disappear instantly.
  const mutation = useMutation({
    mutationFn: saveSkills,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.userSkills });
      const previous = queryClient.getQueryData<{ skills: string[] }>(queryKeys.userSkills);
      queryClient.setQueryData(queryKeys.userSkills, { skills: next });
      return { previous };
    },
    onError: (_error, _next, context) => queryClient.setQueryData(queryKeys.userSkills, context?.previous),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userSkills });
      queryClient.invalidateQueries({ queryKey: queryKeys.techNews });
    },
  });

  const skills = data?.skills ?? [];
  const suggestions = SUGGESTED_SKILLS.filter((s) => !has(skills, s));

  const add = (skill: string) => {
    const value = skill.trim();
    if (value && !has(skills, value)) mutation.mutate([...skills, value]);
  };

  return (
    <SettingsCard
      id="stack"
      title="Your stack"
      description="Languages and frameworks you work with. They drive job matching and the tech radar."
      aside={
        <div className="flex gap-1.5">
          {[
            { label: "Jobs", icon: Briefcase },
            { label: "Tech radar", icon: Radar },
          ].map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex h-6 items-center gap-1.25 rounded-full bg-muted px-2.25 font-mono text-[0.6875rem] text-muted-foreground"
            >
              <Icon className="size-3" />
              {label}
            </span>
          ))}
        </div>
      }
    >
      {isPending && <Skeleton className="mt-4.5 h-20 rounded-xl" />}
      {isError && <p className="mt-4.5 text-sm text-destructive-strong">Failed to load your stack.</p>}

      {!isPending && !isError && (
        <>
          {skills.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-4 py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
                <Layers className="size-4.5 text-ring" />
              </div>
              <p className="mt-3 text-sm font-semibold">No skills yet</p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Add at least one to turn on job matching and the tech radar.
              </p>
            </div>
          ) : (
            <ul className="mt-4.5 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li
                  key={skill}
                  className="inline-flex h-8.5 items-center gap-2 rounded-[10px] border border-input bg-card py-0 pr-1.5 pl-2.5 text-[0.84rem] font-medium shadow-xs"
                >
                  <StackLogo skill={skill} />
                  {skill}
                  <button
                    type="button"
                    onClick={() => mutation.mutate(skills.filter((s) => s !== skill))}
                    aria-label={`Remove ${skill}`}
                    className="flex size-5.5 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-destructive/8 hover:text-destructive-strong focus-visible:ring-4 focus-visible:ring-ring/20"
                  >
                    <X className="size-3.25" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              add(draft);
              setDraft("");
            }}
            className="mt-3.5 flex gap-2"
          >
            <Input
              aria-label="Add a skill"
              placeholder="Add a skill, e.g. Docker"
              value={draft}
              maxLength={40}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!draft.trim()} className="cursor-pointer">
              <Plus />
              Add
            </Button>
          </form>

          {suggestions.length > 0 && (
            <div className="mt-4.5">
              <p className="font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Suggestions
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {suggestions.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => add(skill)}
                    className="inline-flex h-7.5 cursor-pointer items-center gap-1.75 rounded-full border border-dashed border-input bg-card px-2.75 text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:border-ring hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
                  >
                    <Plus className="size-3" />
                    <StackLogo skill={skill} className="size-3.25" />
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mutation.isError && <p className="mt-3 text-sm text-destructive-strong">Couldn&apos;t save your stack. Please try again.</p>}
        </>
      )}
    </SettingsCard>
  );
}
