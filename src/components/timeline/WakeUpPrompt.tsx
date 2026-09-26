"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const COMMON_HOURS = [5, 6, 7, 8, 9, 10, 11, 12];

export const hourLabel = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;

async function setWakeUpHour(date: string, wakeUpHour: number) {
  const res = await fetch("/api/timeline", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, wakeUpHour }),
  });
  if (!res.ok) throw new Error("Failed to save wake-up hour");
  return res.json();
}

/** Hour chips (05–12) plus a full 24h select, and the save button. */
export function WakeUpPicker({
  date,
  defaultHour = 7,
  submitLabel,
  onSaved,
  onCancel,
}: {
  date: string;
  defaultHour?: number;
  submitLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [hour, setHour] = useState(defaultHour);
  const [showAll, setShowAll] = useState(!COMMON_HOURS.includes(defaultHour));

  const mutation = useMutation({
    mutationFn: (wakeUpHour: number) => setWakeUpHour(date, wakeUpHour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(date) });
      onSaved?.();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(hour);
      }}
      className="flex w-full flex-col items-center"
    >
      <div role="radiogroup" aria-label="Wake-up hour" className="grid w-full max-w-95 grid-cols-4 gap-2">
        {COMMON_HOURS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={hour === h}
            onClick={() => setHour(h)}
            className={cn(
              "h-10 cursor-pointer rounded-[10px] border border-input bg-card font-mono text-[0.8125rem] font-medium outline-none transition-colors hover:border-ring focus-visible:ring-4 focus-visible:ring-ring/20",
              hour === h && "border-ring bg-primary/8 ring-3 ring-primary/20"
            )}
          >
            {hourLabel(h)}
          </button>
        ))}
      </div>

      {showAll ? (
        <label className="mt-4 flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          Any hour
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-card px-2.5 font-mono text-[0.8125rem] text-foreground outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-4 text-[0.8125rem] text-muted-foreground">
          Different hour?{" "}
          <button type="button" onClick={() => setShowAll(true)} className="cursor-pointer text-info-strong hover:underline">
            Pick any hour
          </button>
        </p>
      )}

      {mutation.isError && (
        <p className="mt-3 text-sm text-destructive-strong">Couldn&apos;t save. Please try again.</p>
      )}

      <div className="mt-5.5 flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="cursor-pointer">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending} className="cursor-pointer">
          {mutation.isPending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** First visit of a day: ask for the wake-up hour before showing the 8 blocks. */
export function WakeUpPrompt({ date, longDate }: { date: string; longDate: string }) {
  return (
    <Card className="mt-5.5 items-center rounded-[20px] px-8 text-center [--card-spacing:--spacing(10)]">
      <div className="flex size-13 items-center justify-center rounded-[14px] bg-primary/15 text-warning-strong">
        <Sunrise className="size-6" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">What time did you wake up?</h2>
        <p className="mt-1 text-[0.84rem] text-muted-foreground">
          Your timeline for {longDate} starts from this hour.
        </p>
      </div>
      <WakeUpPicker date={date} submitLabel="Generate timeline" />
    </Card>
  );
}
