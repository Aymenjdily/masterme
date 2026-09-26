import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Single source of truth for which Badge color each status/type gets (Amber Lens).

export const jobStatusVariant: Record<string, BadgeVariant> = {
  new: "info",
  applied: "warning",
  interviewing: "special",
  rejected: "destructive",
  accepted: "success",
};

export const projectTypeVariant: Record<string, BadgeVariant> = {
  client: "neutral",
  personal: "neutral",
  saas: "warning",
};

export const projectStatusVariant: Record<string, BadgeVariant> = {
  active: "success",
  completed: "neutral",
  paused: "warning",
};

export const learningStatusVariant: Record<string, BadgeVariant> = {
  not_started: "neutral",
  in_progress: "warning",
  completed: "success",
};

// Plain text colors for inline status labels (e.g. timeline blocks).
export const blockStatusText: Record<string, string> = {
  planned: "text-muted-foreground",
  in_progress: "text-warning-strong",
  completed: "text-success-strong",
};

export function statusLabel(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
