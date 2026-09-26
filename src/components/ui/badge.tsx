import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-input bg-foreground/[0.03] text-muted-foreground",
        info: "border-info/30 bg-info/10 text-info-strong",
        warning: "border-warning/40 bg-warning/15 text-warning-strong",
        special: "border-special/30 bg-special/10 text-special-strong",
        success: "border-success/40 bg-success/15 text-success-strong",
        destructive: "border-destructive/30 bg-destructive/8 text-destructive-strong",
      },
      size: {
        default: "",
        sm: "h-5 gap-1 px-2 text-[0.6875rem]",
      },
      dot: {
        true: "before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        false: "",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
      dot: true,
    },
  }
)

function Badge({
  className,
  variant,
  size,
  dot,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size, dot }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
