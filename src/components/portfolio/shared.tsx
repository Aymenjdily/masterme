"use client";

import { useState, type ReactNode } from "react";
import {
  Book,
  Briefcase,
  Camera,
  Check,
  Code,
  Copy,
  File,
  Globe,
  Link as LinkIcon,
  Mail,
  Music,
  PenLine,
  Star,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Curated icon set for the optional free-text `icon` field.
export const LINK_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  file: File,
  book: Book,
  briefcase: Briefcase,
  code: Code,
  pen: PenLine,
  camera: Camera,
  video: Video,
  music: Music,
  mail: Mail,
  link: LinkIcon,
  star: Star,
};

export const LINK_ICON_NAMES = Object.keys(LINK_ICONS);

export function linkIcon(name?: string | null): LucideIcon {
  return (name && LINK_ICONS[name.trim().toLowerCase()]) || Globe;
}

// Palette tints (Amber Lens) for icon and monogram tiles.
const TINTS = [
  "bg-primary/18 text-warning-strong",
  "bg-info/12 text-info-strong",
  "bg-success/15 text-success-strong",
  "bg-special/12 text-special-strong",
  "bg-stone/45 text-stone-strong",
] as const;

export function tintAt(index: number) {
  return TINTS[index % TINTS.length];
}

const PLATFORMS: Record<string, { mono: string; tint: string }> = {
  github: { mono: "GH", tint: "bg-foreground/6 text-foreground" },
  linkedin: { mono: "in", tint: TINTS[1] },
  x: { mono: "X", tint: TINTS[4] },
  twitter: { mono: "X", tint: TINTS[4] },
  dribbble: { mono: "Dr", tint: TINTS[3] },
  instagram: { mono: "Ig", tint: TINTS[0] },
  behance: { mono: "Be", tint: TINTS[1] },
  youtube: { mono: "YT", tint: "bg-destructive/10 text-destructive-strong" },
  medium: { mono: "M", tint: "bg-foreground/6 text-foreground" },
  facebook: { mono: "f", tint: TINTS[1] },
};

export function platformMark(platform: string) {
  const key = platform.trim().toLowerCase();
  const known = PLATFORMS[key];
  if (known) return known;
  const letters = key.replace(/[^a-z0-9]/g, "");
  const mono = letters ? letters[0].toUpperCase() + (letters[1] ?? "") : "?";
  const hash = [...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return { mono, tint: tintAt(hash) };
}

export function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function SectionCard({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 rounded-[20px] px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[0.9375rem] font-semibold">{title}</h2>
          {count !== undefined && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions / insecure context); nothing else to do.
    }
  }

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={copied ? "Copied" : `Copy ${label} URL`}
      onClick={copy}
      className="cursor-pointer text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-xs"
    >
      {copied ? <Check className="text-success-strong" /> : <Copy />}
    </Button>
  );
}
