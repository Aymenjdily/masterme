import type { LearningItem, LearningPath } from "@/types";

export function pathProgress(path: LearningPath) {
  const total = path.items.length;
  const done = path.items.filter((item) => item.status === "completed").length;
  const inProgress = path.items.filter((item) => item.status === "in_progress").length;
  const next = path.items.find((item) => item.status !== "completed") ?? null;
  return {
    total,
    done,
    inProgress,
    todo: total - done - inProgress,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
    next,
  };
}

const NEXT_STATUS: Record<LearningItem["status"], LearningItem["status"]> = {
  not_started: "in_progress",
  in_progress: "completed",
  completed: "not_started",
};

export function nextItemStatus(status: LearningItem["status"]) {
  return NEXT_STATUS[status];
}

export const PATH_BADGE = {
  active: { variant: "info", label: "Active" },
  paused: { variant: "neutral", label: "Paused" },
  completed: { variant: "success", label: "Completed" },
} as const;
