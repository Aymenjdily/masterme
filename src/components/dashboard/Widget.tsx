import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard widget shell: title (+ optional count), "Open … →" link, body. */
export function Widget({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3.5 rounded-[20px] px-5 [--card-spacing:--spacing(4.5)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        <Link href={href} className="inline-flex items-center gap-1 text-[0.8125rem] text-info-strong hover:underline">
          {linkLabel}
          <ArrowRight className="size-3.25" />
        </Link>
      </div>
      {children}
    </Card>
  );
}

export function WidgetEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-input bg-background px-4 py-5.5 text-center">
      <p className="text-[0.84rem] font-semibold">{title}</p>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function WidgetLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-11 rounded-xl" />
      ))}
    </div>
  );
}

export function WidgetError() {
  return <p className="text-[0.8125rem] text-destructive-strong">Couldn&apos;t load this right now.</p>;
}
