import { cn } from "@/lib/utils";

// Confidence display shared by the AI features. Thresholds match src/lib/ai/confidence.ts.

export function percent(p: number) {
  return `${Math.round(p * 100)}%`;
}

export function confidenceTone(p: number) {
  if (p >= 0.9) return { label: "Sure", text: "text-success-strong", bar: "bg-success" };
  if (p >= 0.5) return { label: "Likely", text: "text-warning-strong", bar: "bg-primary" };
  return { label: "Unsure", text: "text-destructive-strong", bar: "bg-destructive" };
}

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const tone = confidenceTone(value);
  return (
    <div className={cn("ml-auto shrink-0 text-right", className)} aria-label={`${percent(value)} confident`}>
      <p className={cn("font-mono text-[0.8125rem] font-medium", tone.text)}>{percent(value)}</p>
      <div className="mt-1 h-1.25 w-24 overflow-hidden rounded-full bg-muted sm:w-28">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: percent(value) }} />
      </div>
      <p className={cn("mt-1 text-[0.6875rem]", tone.text)}>{tone.label}</p>
    </div>
  );
}
