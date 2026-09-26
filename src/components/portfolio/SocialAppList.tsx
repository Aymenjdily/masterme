"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, AtSign, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { SocialApp } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SocialAppForm } from "@/components/forms/SocialAppForm";
import {
  SectionCard,
  platformMark,
} from "@/components/portfolio/shared";
import { DeleteDialog, EmptyState, FormDialog } from "@/components/ui-patterns/dialogs";

async function fetchSocialApps(): Promise<SocialApp[]> {
  const res = await fetch("/api/social-apps");
  if (!res.ok) throw new Error("Failed to load social apps");
  return res.json();
}

async function deleteSocialApp(id: string) {
  const res = await fetch(`/api/social-apps/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete social app");
  return res.json();
}

const miniActionClass =
  "size-7 cursor-pointer rounded-[7px] bg-card text-muted-foreground shadow-xs hover:bg-card hover:text-foreground";

export function SocialAppList() {
  const queryClient = useQueryClient();
  // null = dialog closed, "add" = new app, otherwise the app being edited
  const [editing, setEditing] = useState<"add" | SocialApp | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: apps, isPending, isError } = useQuery({
    queryKey: queryKeys.socialApps,
    queryFn: fetchSocialApps,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSocialApp,
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.socialApps });
    },
  });

  const closeDialog = () => setEditing(null);
  const editingApp = editing && editing !== "add" ? editing : undefined;
  const confirmingApp = apps?.find((app) => app.id === confirmingId);

  return (
    <SectionCard
      title="Social apps"
      count={apps?.length}
      action={
        <Button size="sm" variant="outline" onClick={() => setEditing("add")} className="cursor-pointer">
          <Plus />
          Add app
        </Button>
      }
    >
      {isPending && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-17 rounded-[14px]" />
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-destructive-strong">Failed to load social apps.</p>}

      {apps?.length === 0 && (
        <EmptyState
          icon={AtSign}
          iconClassName="text-info-strong"
          title="No social apps yet"
          description="Add GitHub, LinkedIn and the rest."
          actionLabel="Add app"
          onAction={() => setEditing("add")}
        />
      )}

      {apps && apps.length > 0 && (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {apps.map((app) => {
            const mark = platformMark(app.platform);
            return (
              <li key={app.id} className="group relative">
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-[14px] border bg-card p-3.5 outline-none transition-colors hover:bg-background focus-visible:ring-4 focus-visible:ring-ring/20"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-[11px] text-[0.8125rem] font-bold",
                      mark.tint
                    )}
                  >
                    {mark.mono}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{app.platform}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      @{app.username.replace(/^@/, "")}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-opacity group-focus-within:opacity-0 group-hover:opacity-0" />
                </a>
                <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Edit ${app.platform}`}
                    onClick={() => setEditing(app)}
                    className={miniActionClass}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Delete ${app.platform}`}
                    onClick={() => setConfirmingId(app.id)}
                    className={miniActionClass}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setEditing("add")}
              className="flex h-full min-h-17 w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-dashed border-input text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20"
            >
              <Plus className="size-4" />
              Add app
            </button>
          </li>
        </ul>
      )}

      <DeleteDialog
        name={confirmingApp?.platform ?? ""}
        open={confirmingApp !== undefined}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setConfirmingId(null);
          deleteMutation.reset();
        }}
        onConfirm={() => confirmingApp && deleteMutation.mutate(confirmingApp.id)}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && closeDialog()}
        title={editingApp ? "Edit social app" : "Add social app"}
        description="Profiles open in a new tab from your Portfolio page."
      >
        {editing !== null && (
          <SocialAppForm key={editingApp?.id ?? "new"} app={editingApp} onDone={closeDialog} />
        )}
      </FormDialog>
    </SectionCard>
  );
}
