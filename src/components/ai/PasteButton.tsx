"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/components/ai/Toast";
import { PasteFlow, invalidateAll, recordOutcome, type PasteSaved } from "@/components/ai/PasteAnything";

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Header entry point for Paste anything, plus the Ctrl/⌘ + Shift + V shortcut and the saved toast. */
export function PasteButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Inside a field the browser shortcut keeps its meaning (paste as plain text).
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v" && !isEditable(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+Shift+V"
        className="h-9 cursor-pointer gap-2 rounded-[10px] px-2.5 md:pr-1.5 md:pl-3"
      >
        <Sparkles className="size-3.75 text-ring" />
        <span className="hidden md:inline">Paste anything</span>
        <kbd className="hidden rounded-md border border-b-2 bg-muted px-1.5 font-mono text-[0.625rem] font-medium text-muted-foreground lg:inline">
          Ctrl ⇧ V
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[600px]">
          <PasteFlow
            onCancel={() => setOpen(false)}
            onSaved={(saved) => {
              setOpen(false);
              showSavedToast(saved, () => invalidateAll(queryClient));
            }}
          />
        </DialogContent>
      </Dialog>

    </>
  );
}

function showSavedToast(saved: PasteSaved, refresh: () => void) {
  showToast({
    title: saved.title,
    detail: saved.detail,
    link: { href: saved.href, label: saved.hrefLabel },
    onUndo: async () => {
      for (const url of saved.undo) {
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok && res.status !== 404) throw new Error("Undo failed");
      }
      for (const id of saved.eventIds) recordOutcome(id, "rejected");
      refresh();
    },
  });
}
