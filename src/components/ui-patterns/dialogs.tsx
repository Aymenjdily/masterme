"use client";

import { useState, type ReactNode } from "react";
import { Plus, Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Shared Amber Lens popups and empty state used across dashboard pages.

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({
  name,
  open,
  pending,
  failed,
  onCancel,
  onConfirm,
}: {
  name: string;
  open: boolean;
  pending: boolean;
  failed?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Keep the last name while the dialog animates out after the item is gone.
  const [shownName, setShownName] = useState(name);
  if (name && name !== shownName) setShownName(name);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <DialogContent showCloseButton={false} role="alertdialog" className="max-w-sm">
        <DialogHeader className="items-center pr-6 text-center">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-destructive/10">
            <Trash2 className="size-[18px] text-destructive-strong" />
          </div>
          <DialogTitle>Delete {shownName}?</DialogTitle>
          <DialogDescription>This can&apos;t be undone.</DialogDescription>
          {failed && (
            <p className="mt-2 text-[0.8125rem] text-destructive-strong">
              Couldn&apos;t delete. Please try again.
            </p>
          )}
        </DialogHeader>
        <DialogFooter className="grid grid-cols-2">
          <Button variant="outline" onClick={onCancel} disabled={pending} className="cursor-pointer">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending} autoFocus className="cursor-pointer">
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmptyState({
  icon: Icon,
  iconClassName,
  title,
  description,
  actionLabel,
  primary,
  onAction,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: string;
  actionLabel: string;
  primary?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-5 py-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl border bg-card">
        <Icon className={cn("size-[18px] text-ring", iconClassName)} />
      </div>
      <p className="mt-3.5 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>
      <Button
        size="sm"
        variant={primary ? "default" : "outline"}
        onClick={onAction}
        className="mt-4 cursor-pointer"
      >
        <Plus />
        {actionLabel}
      </Button>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; dotClassName?: string }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-[10px] bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[7px] text-[0.8125rem] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/20",
              selected && "bg-card text-foreground shadow-[0_1px_3px_#1b1e291a]"
            )}
          >
            {option.dotClassName && <span className={cn("size-2 rounded-full", option.dotClassName)} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
