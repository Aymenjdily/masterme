import type { TimeBlock } from "@/types";
import { Card } from "@/components/ui/card";
import { hourLabel } from "@/components/timeline/WakeUpPrompt";

const SLOTS = 8;
const RADIUS = 56;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DayProgress({
  blocks,
  now,
}: {
  blocks: TimeBlock[];
  now: { block: TimeBlock; clockHour: number } | null;
}) {
  const completed = blocks.filter((b) => b.status === "completed").length;
  const inProgress = blocks.filter((b) => b.status === "in_progress").length;
  const planned = blocks.filter((b) => b.status === "planned").length;
  const free = SLOTS - blocks.length;

  const doneLength = (CIRCUMFERENCE * completed) / SLOTS;
  const progressLength = (CIRCUMFERENCE * inProgress) / SLOTS;

  const legend = [
    { label: "Completed", value: completed, dot: "bg-success" },
    { label: "In progress", value: inProgress, dot: "bg-primary" },
    { label: "Planned", value: planned, dot: "border-2 border-info bg-card" },
    { label: "Free", value: free, dot: "border-[1.5px] border-dashed border-foreground/25 bg-card" },
  ];

  return (
    <Card className="gap-0 rounded-[20px] px-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.9375rem] font-semibold">Day progress</h2>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {blocks.length} of {SLOTS} filled
        </span>
      </div>

      <div className="relative mx-auto mt-2.5 size-33">
        <svg viewBox="0 0 132 132" className="size-33 -rotate-90" aria-hidden>
          <circle cx="66" cy="66" r={RADIUS} fill="none" strokeWidth="12" className="stroke-muted" />
          {completed > 0 && (
            <circle
              cx="66"
              cy="66"
              r={RADIUS}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              className="stroke-success transition-[stroke-dasharray] duration-500"
              strokeDasharray={`${doneLength} ${CIRCUMFERENCE}`}
            />
          )}
          {inProgress > 0 && (
            <circle
              cx="66"
              cy="66"
              r={RADIUS}
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              className="stroke-primary transition-[stroke-dasharray] duration-500"
              strokeDasharray={`${progressLength} ${CIRCUMFERENCE}`}
              strokeDashoffset={-doneLength}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[1.75rem] font-medium">
            {completed}/{SLOTS}
          </span>
          <span className="text-xs text-muted-foreground">completed</span>
        </div>
      </div>

      <ul className="mt-4.5 flex flex-col gap-2.5">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[0.8125rem]">
            <span className={`size-2.5 rounded-full ${item.dot}`} />
            {item.label}
            <span className="ml-auto font-mono font-medium">{item.value}</span>
          </li>
        ))}
      </ul>

      {now && (
        <div className="mt-4.5 rounded-[14px] border border-primary/40 bg-primary/5 p-3.5">
          <p className="font-mono text-[0.65625rem] font-medium tracking-[0.12em] text-warning-strong uppercase">
            Right now
          </p>
          <p className="mt-1.5 text-sm font-semibold">{now.block.title}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {hourLabel(now.clockHour)} – {hourLabel(now.clockHour + 1)} · {now.block.priority} priority
          </p>
        </div>
      )}
    </Card>
  );
}
