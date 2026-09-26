import { cn } from "@/lib/utils";

const blobClass =
  "absolute rounded-full blur-[90px] motion-reduce:animate-none will-change-transform";

// Decorative Amber Lens "shader": blurred palette blobs drifting slowly, plus grain.
// Pure CSS, sits behind its parent's content (parent must be `relative isolate`).
export function ShaderBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background", className)}>
      <div className={cn(blobClass, "top-[-18%] left-[-12%] size-[62vmax] bg-info/55 animate-blob-a")} />
      <div className={cn(blobClass, "top-[-22%] right-[-14%] size-[56vmax] bg-primary/55 animate-blob-b")} />
      <div className={cn(blobClass, "right-[-16%] bottom-[-34%] size-[56vmax] bg-success/30 animate-blob-c")} />
      <div className={cn(blobClass, "bottom-[-24%] left-[-14%] size-[54vmax] bg-stone/70 animate-blob-b")} />
      <div className={cn(blobClass, "top-1/2 left-1/2 size-[34vmax] -translate-x-1/2 -translate-y-1/2 bg-primary/15")} />
      <div className="absolute inset-0 bg-grain opacity-35 mix-blend-soft-light" />
    </div>
  );
}
