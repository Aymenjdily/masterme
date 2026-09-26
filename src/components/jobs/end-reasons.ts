import { Briefcase, Clock, Hand, MoreHorizontal, Trophy, X, type LucideIcon } from "lucide-react";
import type { EndReason } from "@/lib/validations";

export const END_REASON_META: Record<EndReason, { label: string; hint: string; icon: LucideIcon; tone: string }> = {
  offer: { label: "Got an offer", hint: "It worked out through them.", icon: Trophy, tone: "bg-success/15 text-success-strong" },
  application: {
    label: "Moved to an application",
    hint: "Now tracked in Applications.",
    icon: Briefcase,
    tone: "bg-info/12 text-info-strong",
  },
  passed: { label: "They passed", hint: "Rejected, or the role was filled.", icon: X, tone: "bg-destructive/8 text-destructive-strong" },
  not_interested: {
    label: "I'm not interested",
    hint: "Role, salary or company didn't fit.",
    icon: Hand,
    tone: "bg-stone/45 text-stone-strong",
  },
  no_reply: { label: "No reply", hint: "Stopped answering after follow-ups.", icon: Clock, tone: "bg-primary/15 text-warning-strong" },
  other: { label: "Other", hint: "Write it in the note.", icon: MoreHorizontal, tone: "bg-muted text-muted-foreground" },
};
