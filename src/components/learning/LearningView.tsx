"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Route } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import type { LearningItem, LearningPath } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteDialog, EmptyState, FormDialog } from "@/components/ui-patterns/dialogs";
import { LearningPathForm } from "@/components/forms/LearningPathForm";
import { LearningItemForm } from "@/components/forms/LearningItemForm";
import { PathCard } from "@/components/learning/PathCard";
import { PathDetail } from "@/components/learning/PathDetail";
import { nextItemStatus, pathProgress } from "@/components/learning/progress";

type Filter = "all" | LearningPath["status"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

type Deleting =
  | { kind: "path"; id: string; name: string }
  | { kind: "item"; id: string; name: string };

async function fetchPaths(): Promise<LearningPath[]> {
  const res = await fetch("/api/learning-paths");
  if (!res.ok) throw new Error("Failed to load learning paths");
  return res.json();
}

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} failed`);
  return res.json();
}

function updateItemInPaths(
  paths: LearningPath[] | undefined,
  itemId: string,
  update: (item: LearningItem) => LearningItem
) {
  return paths?.map((path) => ({
    ...path,
    items: path.items.map((item) => (item.id === itemId ? update(item) : item)),
  }));
}

export function LearningView() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pathDialog, setPathDialog] = useState<"add" | LearningPath | null>(null);
  const [stepDialog, setStepDialog] = useState<{ path: LearningPath; item?: LearningItem } | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const { data: paths, isPending, isError } = useQuery({
    queryKey: queryKeys.learningPaths,
    queryFn: fetchPaths,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.learningPaths });

  const pathStatusMutation = useMutation({
    mutationFn: (path: LearningPath) =>
      request(`/api/learning-paths/${path.id}`, "PATCH", {
        status: path.status === "active" ? "paused" : "active",
      }),
    onSettled: invalidate,
  });

  // Optimistic so clicking the circle feels instant.
  const stepStatusMutation = useMutation({
    mutationFn: ({ item, status }: { item: LearningItem; status: LearningItem["status"] }) =>
      request(`/api/learning-items/${item.id}`, "PATCH", { status }),
    onMutate: async ({ item, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.learningPaths });
      const previous = queryClient.getQueryData<LearningPath[]>(queryKeys.learningPaths);
      queryClient.setQueryData<LearningPath[]>(queryKeys.learningPaths, (old) =>
        updateItemInPaths(old, item.id, (current) => ({ ...current, status }))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKeys.learningPaths, context?.previous);
    },
    onSettled: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ item, direction }: { item: LearningItem; direction: "up" | "down" }) =>
      request(`/api/learning-items/${item.id}/reorder`, "POST", { direction }),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (target: Deleting) =>
      request(
        target.kind === "path" ? `/api/learning-paths/${target.id}` : `/api/learning-items/${target.id}`,
        "DELETE"
      ),
    onSuccess: () => {
      setDeleting(null);
      invalidate();
    },
  });

  const counts = {
    all: paths?.length ?? 0,
    active: paths?.filter((p) => p.status === "active").length ?? 0,
    paused: paths?.filter((p) => p.status === "paused").length ?? 0,
    completed: paths?.filter((p) => p.status === "completed").length ?? 0,
  };

  const visible = (paths ?? []).filter((p) => filter === "all" || p.status === filter);
  const selected = visible.find((p) => p.id === selectedId) ?? visible[0];

  const totals = (paths ?? []).reduce(
    (acc, path) => {
      const progress = pathProgress(path);
      return {
        done: acc.done + progress.done,
        total: acc.total + progress.total,
        inProgress: acc.inProgress + progress.inProgress,
      };
    },
    { done: 0, total: 0, inProgress: 0 }
  );

  const editingPath = pathDialog && pathDialog !== "add" ? pathDialog : undefined;

  return (
    <div className="flex flex-col px-2 pt-2 pb-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.625rem] font-semibold tracking-tight">Learning</h1>
          <p className="mt-1 text-sm text-muted-foreground">Build learning paths and track every step.</p>
        </div>
        <Button onClick={() => setPathDialog("add")} className="cursor-pointer">
          <Plus />
          New path
        </Button>
      </div>

      {isPending && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
      )}

      {isError && <p className="mt-5 text-sm text-destructive-strong">Failed to load learning paths.</p>}

      {paths && paths.length === 0 && (
        <Card className="mt-5 rounded-[20px] px-4.5 [--card-spacing:--spacing(4.5)]">
          <EmptyState
            icon={Route}
            title="Start your first learning path"
            description="Break a topic into steps and track them one by one."
            actionLabel="New path"
            primary
            onAction={() => setPathDialog("add")}
          />
        </Card>
      )}

      {paths && paths.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="cursor-pointer">
                    {f.label}
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">{counts[f.value]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex gap-4.5 font-mono text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{totals.done}</span> / {totals.total} steps done
              </span>
              <span>
                <span className="font-medium text-foreground">{totals.inProgress}</span> in progress
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_1fr]">
            <div className="flex flex-col gap-2.5">
              {visible.length === 0 && (
                <p className="rounded-2xl border border-dashed border-input bg-background px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
                  No {filter} paths.
                </p>
              )}
              {visible.map((path) => (
                <PathCard
                  key={path.id}
                  path={path}
                  selected={path.id === selected?.id}
                  onSelect={() => setSelectedId(path.id)}
                />
              ))}
            </div>

            {selected && (
              <PathDetail
                path={selected}
                moving={moveMutation.isPending}
                onToggleStatus={(path) => pathStatusMutation.mutate(path)}
                onEditPath={(path) => setPathDialog(path)}
                onDeletePath={(path) => setDeleting({ kind: "path", id: path.id, name: path.title })}
                onAddStep={(path) => setStepDialog({ path })}
                onEditStep={(path, item) => setStepDialog({ path, item })}
                onDeleteStep={(item) => setDeleting({ kind: "item", id: item.id, name: item.title })}
                onCycleStep={(item) => stepStatusMutation.mutate({ item, status: nextItemStatus(item.status) })}
                onMoveStep={(item, direction) => moveMutation.mutate({ item, direction })}
              />
            )}
          </div>
        </>
      )}

      <FormDialog
        open={pathDialog !== null}
        onOpenChange={(open) => !open && setPathDialog(null)}
        title={editingPath ? "Edit learning path" : "New learning path"}
        description="Group the steps you want to learn in order."
      >
        {pathDialog !== null && (
          <LearningPathForm
            key={editingPath?.id ?? "new"}
            path={editingPath}
            onDone={(saved) => {
              setPathDialog(null);
              if (saved && !editingPath) {
                setFilter("all");
                setSelectedId(saved.id);
              }
            }}
          />
        )}
      </FormDialog>

      <FormDialog
        open={stepDialog !== null}
        onOpenChange={(open) => !open && setStepDialog(null)}
        title={stepDialog?.item ? "Edit step" : "Add step"}
        description={stepDialog ? `${stepDialog.item ? "In" : "To"} ${stepDialog.path.title}` : ""}
      >
        {stepDialog !== null && (
          <LearningItemForm
            key={stepDialog.item?.id ?? "new"}
            pathId={stepDialog.path.id}
            item={stepDialog.item}
            onDone={() => setStepDialog(null)}
          />
        )}
      </FormDialog>

      <DeleteDialog
        name={deleting?.name ?? ""}
        open={deleting !== null}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setDeleting(null);
          deleteMutation.reset();
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
