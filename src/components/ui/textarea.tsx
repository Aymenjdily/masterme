import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-19 w-full min-w-0 resize-y rounded-[10px] border border-input bg-card px-3.5 py-2.5 text-base leading-relaxed text-foreground transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/12 md:text-sm dark:bg-background",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
