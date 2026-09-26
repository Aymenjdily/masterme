"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import type { PortfolioLink } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioForm } from "@/components/forms/PortfolioForm";
import {
  CopyButton,
  SectionCard,
  displayUrl,
  linkIcon,
  tintAt,
} from "@/components/portfolio/shared";
import { DeleteDialog, EmptyState, FormDialog } from "@/components/ui-patterns/dialogs";

async function fetchPortfolioLinks(): Promise<PortfolioLink[]> {
  const res = await fetch("/api/portfolio-links");
  if (!res.ok) throw new Error("Failed to load portfolio links");
  return res.json();
}

async function deletePortfolioLink(id: string) {
  const res = await fetch(`/api/portfolio-links/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete portfolio link");
  return res.json();
}

const actionClass =
  "cursor-pointer text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-xs";

export function PortfolioLinkList() {
  const queryClient = useQueryClient();
  // null = dialog closed, "add" = new link, otherwise the link being edited
  const [editing, setEditing] = useState<"add" | PortfolioLink | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: links, isPending, isError } = useQuery({
    queryKey: queryKeys.portfolioLinks,
    queryFn: fetchPortfolioLinks,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioLink,
    onSuccess: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioLinks });
    },
  });

  const closeDialog = () => setEditing(null);
  const editingLink = editing && editing !== "add" ? editing : undefined;
  const confirmingLink = links?.find((link) => link.id === confirmingId);

  return (
    <SectionCard
      title="Portfolio links"
      count={links?.length}
      action={
        <Button size="sm" variant="outline" onClick={() => setEditing("add")} className="cursor-pointer">
          <Plus />
          Add link
        </Button>
      }
    >
      {isPending && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-17 rounded-[14px]" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive-strong">Failed to load portfolio links.</p>
      )}

      {links?.length === 0 && (
        <EmptyState
          icon={Globe}
          title="No portfolio links yet"
          description="Add your portfolio so it's one click away."
          actionLabel="Add link"
          primary
          onAction={() => setEditing("add")}
        />
      )}

      {links && links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.map((link, index) => {
            const Icon = linkIcon(link.icon);
            return (
              <li
                key={link.id}
                className="group flex items-center gap-3.5 rounded-[14px] border bg-card p-3 transition-colors hover:bg-background"
              >
                <div className={cn("flex size-10.5 shrink-0 items-center justify-center rounded-xl", tintAt(index))}>
                  <Icon className="size-4.25" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{link.title}</span>
                    {index === 0 && (
                      <Badge size="sm" variant="warning">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                    {displayUrl(link.url)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <CopyButton value={link.url} label={link.title} />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Open ${link.title}`}
                    className={actionClass}
                    nativeButton={false}
                    render={<a href={link.url} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLink />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${link.title}`}
                    onClick={() => setEditing(link)}
                    className={actionClass}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${link.title}`}
                    onClick={() => setConfirmingId(link.id)}
                    className={actionClass}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteDialog
        name={confirmingLink?.title ?? ""}
        open={confirmingLink !== undefined}
        pending={deleteMutation.isPending}
        failed={deleteMutation.isError}
        onCancel={() => {
          setConfirmingId(null);
          deleteMutation.reset();
        }}
        onConfirm={() => confirmingLink && deleteMutation.mutate(confirmingLink.id)}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && closeDialog()}
        title={editingLink ? "Edit portfolio link" : "Add portfolio link"}
        description="Links show on your Portfolio page in the order you add them."
      >
        {editing !== null && (
          <PortfolioForm key={editingLink?.id ?? "new"} link={editingLink} onDone={closeDialog} />
        )}
      </FormDialog>
    </SectionCard>
  );
}
