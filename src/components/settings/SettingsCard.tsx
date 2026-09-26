import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Settings section card: title, description, optional right-side slot, body. */
export function SettingsCard({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-6 gap-0 rounded-[20px] px-5 sm:px-6 [--card-spacing:--spacing(5.5)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      {children}
    </Card>
  );
}
