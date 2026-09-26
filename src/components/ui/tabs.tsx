import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-10 w-fit items-center gap-1 rounded-xl bg-muted p-1",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground data-active:bg-card data-active:text-foreground data-active:shadow-[0_1px_3px_#1b1e291a,inset_0_-2px_0_var(--primary)] dark:data-active:bg-accent focus-visible:ring-4 focus-visible:ring-ring/20",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
