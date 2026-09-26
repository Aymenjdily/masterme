"use client";

import { useEffect, useState } from "react";
import { Layers, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileCard, type SettingsUser } from "@/components/settings/ProfileCard";
import { SkillsEditor } from "@/components/settings/SkillsEditor";
import { SecurityCard } from "@/components/settings/SecurityCard";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "stack", label: "Your stack", icon: Layers },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsView({ user }: { user: SettingsUser }) {
  const [active, setActive] = useState<SectionId>("profile");

  // Highlight the section currently in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: "-20% 0px -55% 0px" }
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div>
        <h1 className="text-[1.625rem] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your profile, the stack that powers Jobs and Tech radar, and account security.
        </p>
      </div>

      <div className="mt-5.5 grid grid-cols-1 items-start gap-4 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Settings sections"
          className="flex gap-1 rounded-[20px] border bg-card p-2.5 shadow-card md:sticky md:top-4 md:flex-col"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setActive(id);
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={cn(
                "relative flex h-9.5 flex-1 items-center gap-2.5 rounded-[10px] px-2.5 text-[0.84rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20 md:flex-none",
                active === id &&
                  "bg-background font-medium text-foreground before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary before:content-[''] [&_svg]:text-ring"
              )}
            >
              <Icon className="size-4" />
              {label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <ProfileCard user={user} />
          <SkillsEditor />
          <SecurityCard />
        </div>
      </div>
    </div>
  );
}
