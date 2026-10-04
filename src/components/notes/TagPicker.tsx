"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTE_TAGS_MAX } from "@/lib/validations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TAG_RE = /^[a-z0-9-]{1,24}$/;

/** Pick an existing tag or type a new one. Tags are lowercase, max 5 per note. */
export function TagPicker({
  value,
  allTags,
  onAdd,
}: {
  value: string[];
  allTags: { name: string; count: number }[];
  onAdd: (tag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);

  const term = text.trim().toLowerCase().replace(/^#/, "");
  const options: { name: string; hint: string; create?: boolean }[] = allTags
    .filter((t) => !value.includes(t.name) && t.name.includes(term))
    .slice(0, 6)
    .map((t) => ({ name: t.name, hint: `${t.count} note${t.count === 1 ? "" : "s"}` }));
  if (term && TAG_RE.test(term) && !value.includes(term) && !allTags.some((t) => t.name === term)) {
    options.push({ name: term, hint: "new tag", create: true });
  }
  const full = value.length >= NOTE_TAGS_MAX;

  const pick = (name: string) => {
    onAdd(name);
    setText("");
    setActive(0);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setText("");
      }}
    >
      <PopoverTrigger
        disabled={full}
        title={full ? `Up to ${NOTE_TAGS_MAX} tags per note` : "Add a tag"}
        className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-input px-2.25 font-mono text-[0.71875rem] font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-2.75" />
        tag
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        <input
          autoFocus
          value={text}
          maxLength={25}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const option = options[active];
              if (option) pick(option.name);
            }
          }}
          placeholder="Find or create a tag"
          aria-label="Tag name"
          className="mb-1.5 h-8.5 w-full rounded-lg border border-input bg-card px-2.5 font-mono text-[0.78125rem] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/20"
        />
        {options.length === 0 ? (
          <p className="px-2.5 py-1.75 text-xs text-muted-foreground">
            {term && !TAG_RE.test(term) ? "Use a–z, 0–9 and -" : "Type to create a tag"}
          </p>
        ) : (
          <div role="listbox" aria-label="Tags">
            {options.map((option, i) => (
              <button
                key={option.name}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(option.name)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.75 font-mono text-[0.78125rem]",
                  i === active && "bg-background"
                )}
              >
                <span>
                  {option.create && "Create "}
                  <b className={cn("font-medium", option.create && "text-warning-strong")}>#{option.name}</b>
                </span>
                <span className="font-sans text-[0.71875rem] text-muted-foreground">{option.hint}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
