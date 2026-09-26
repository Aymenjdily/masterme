"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const TOAST_MS = 8000;

type ToastProps = {
  title: string;
  detail?: string;
  link?: { href: string; label: string };
  /** Throws when the undo failed */
  onUndo?: () => Promise<void>;
};

// One toast at a time, shown by <ToastHost /> in the header so it survives the row or dialog that opened it.
let current: (ToastProps & { id: number }) | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(toast: ToastProps) {
  current = { ...toast, id: nextId++ };
  emit();
}

function hideToast(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

export function ToastHost() {
  const toast = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null
  );
  if (!toast) return null;
  return <ActionToast key={toast.id} {...toast} onClose={() => hideToast(toast.id)} />;
}

/** Dark confirmation toast used by the AI features, with an optional link and Undo. */
export function ActionToast({
  title,
  detail,
  link,
  onUndo,
  onClose,
}: ToastProps & { onClose: () => void }) {
  const [undoing, setUndoing] = useState(false);
  const [failed, setFailed] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (undoing) return;
    const timer = setTimeout(() => onCloseRef.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [undoing]);

  async function undo() {
    if (!onUndo) return;
    setUndoing(true);
    setFailed(false);
    try {
      await onUndo();
      onClose();
    } catch {
      setFailed(true);
      setUndoing(false);
    }
  }

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 left-4 z-60 flex items-center gap-3 rounded-[14px] bg-foreground px-3.5 py-3 text-[0.8125rem] text-background shadow-popover sm:left-auto sm:w-max sm:max-w-lg"
    >
      <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-success/30 text-success">
        <Check className="size-3.5 stroke-[2.6]" />
      </span>
      <p className="min-w-0 flex-1 truncate">
        <b className="font-medium">{failed ? "Couldn't undo. Try again." : title}</b>
        {!failed && detail && <span className="text-background/70"> {detail}</span>}
      </p>
      {link && (
        <Link href={link.href} onClick={onClose} className="shrink-0 font-medium whitespace-nowrap text-primary hover:underline">
          {link.label} →
        </Link>
      )}
      {onUndo && (
        <button
          type="button"
          onClick={undo}
          disabled={undoing}
          className="shrink-0 cursor-pointer border-l border-background/15 pl-3 font-medium text-background/70 hover:text-background disabled:opacity-60"
        >
          {undoing ? "Undoing…" : "Undo"}
        </button>
      )}
    </div>
  );
}
