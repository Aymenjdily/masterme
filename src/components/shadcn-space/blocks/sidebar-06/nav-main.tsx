"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

// Amber Lens nav item: quiet by default, chalk pill + amber indicator when active
const itemClass =
  "relative h-10 cursor-pointer rounded-[10px] px-3 py-2 text-[0.84rem] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground [&_svg]:size-[17px]";
const activeItemClass =
  "bg-sidebar-accent! text-sidebar-accent-foreground! before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary before:content-[''] [&_svg]:text-ring";

export type NavItem = {
  label?: string;
  isSection?: boolean;
  title?: string;
  icon?: LucideIcon;
  href?: string;
  children?: NavItem[];
  /** Small red count after the title (hidden when 0) */
  badge?: number;
};

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  // Derive active item from the current URL so it stays in sync on navigation
  const currentTitle = React.useMemo(() => {
    const links = items.filter(
      (i) => !i.isSection && i.title && i.href
    );
    return links.find(
      (i) =>
        i.href === pathname ||
        (i.href !== "/" && pathname.startsWith(`${i.href}/`))
    )?.title ?? null;
  }, [items, pathname]);

  const [activeParent, setActiveParent] = React.useState<string | null>(
    currentTitle ?? (items.find((i) => !i.isSection)?.title || null)
  );
  const [activeChild, setActiveChild] = React.useState<string | null>(null);

  // Follow the URL on navigation (adjusting state during render, not in an effect)
  const [syncedTitle, setSyncedTitle] = React.useState(currentTitle);
  if (currentTitle !== syncedTitle) {
    setSyncedTitle(currentTitle);
    if (currentTitle) {
      setActiveParent(currentTitle);
      setActiveChild(null);
    }
  }

  return (
    <>
      {items.map((item, index) => (
        <NavMainItem
          key={`${item.isSection ? "section" : "item"}-${item.title || item.label || index}`}
          item={item}
          activeParent={activeParent}
          setActiveParent={setActiveParent}
          activeChild={activeChild}
          setActiveChild={setActiveChild}
        />
      ))}
    </>
  );
}

function NavMainItem({
  item,
  activeParent,
  setActiveParent,
  activeChild,
  setActiveChild,
}: {
  item: NavItem;
  activeParent: string | null;
  activeChild: string | null;
  setActiveParent: (val: string) => void;
  setActiveChild: (val: string | null) => void;
}) {
  const hasChildren = !!item.children?.length;
  const isParentActive = activeParent === item.title;
  const [isOpen, setIsOpen] = React.useState(isParentActive);

  // Open when this item becomes the active parent
  const [wasActive, setWasActive] = React.useState(isParentActive);
  if (isParentActive !== wasActive) {
    setWasActive(isParentActive);
    if (isParentActive) setIsOpen(true);
  }

  // Section label
  if (item.isSection && item.label) {
    return (
      <SidebarGroup className="p-0 pt-5 first:pt-0">
        <SidebarGroupLabel className="h-6 p-0 font-mono text-[0.625rem] font-medium tracking-[0.12em] uppercase text-muted-foreground/80">
          {item.label}
        </SidebarGroupLabel>
      </SidebarGroup>
    );
  }

  // Item with children → collapsible
  if (hasChildren && item.title) {
    return (
      <SidebarGroup className="p-0">
        <SidebarMenu>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger
                className="w-full"
                render={
                  <SidebarMenuButton
                    id={`nav-main-trigger-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    tooltip={item.title}
                    isActive={isParentActive}
                    onClick={() => setActiveParent(item.title!)}
                    className={cn(
                      itemClass,
                      isParentActive && activeItemClass
                    )}
                  >
                    {item.icon && <item.icon size={16} />}
                    <span>{item.title}</span>
                    <ChevronRight
                      className={cn(
                        "ml-auto transition-transform duration-200",
                        isOpen && "rotate-90"
                      )}
                    />
                  </SidebarMenuButton>
                }
              />
              <CollapsibleContent>
                <SidebarMenuSub className="me-0 pe-0">
                  {item.children!.map((child, index) => (
                    <NavMainSubItem
                      key={child.title || index}
                      item={child}
                      activeParent={activeParent}
                      setActiveParent={setActiveParent}
                      activeChild={activeChild}
                      setActiveChild={setActiveChild}
                      parentTitle={item.title}
                    />
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  // Item without children
  if (item.title) {
    return (
      <SidebarGroup className="p-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              id={`nav-main-button-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
              tooltip={item.title}
              isActive={isParentActive}
              onClick={() => {
                setActiveParent(item.title!);
                setActiveChild(null);
              }}
              className={cn(
                itemClass,
                isParentActive && activeItemClass
              )}
              render={<Link href={item.href ?? "#"} />}
            >
              {item.icon && <item.icon />}
              {item.title}
              {!!item.badge && (
                <span
                  aria-label={`${item.badge} new`}
                  className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[0.6875rem] font-semibold text-white"
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return null;
}

function NavMainSubItem({
  item,
  activeParent,
  setActiveParent,
  activeChild,
  setActiveChild,
  parentTitle,
}: {
  item: NavItem;
  activeParent: string | null;
  activeChild: string | null;
  setActiveParent: (val: string) => void;
  setActiveChild: (val: string | null) => void;
  parentTitle?: string;
}) {
  const hasChildren = !!item.children?.length;
  const [isOpen, setIsOpen] = React.useState(false);

  if (hasChildren && item.title) {
    return (
      <SidebarMenuSubItem>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger
            className="w-full"
            render={
              <SidebarMenuSubButton
                id={`nav-sub-trigger-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                className="rounded-md text-sm font-medium px-3 py-2 h-9"
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                <ChevronRight
                  className={cn(
                    "ml-auto transition-transform duration-200",
                    isOpen && "rotate-90"
                  )}
                />
              </SidebarMenuSubButton>
            }
          />
          <CollapsibleContent>
            <SidebarMenuSub className="me-0 pe-0">
              {item.children!.map((child, index) => (
                <NavMainSubItem
                  key={child.title || index}
                  item={child}
                  activeParent={activeParent}
                  setActiveParent={setActiveParent}
                  activeChild={activeChild}
                  setActiveChild={setActiveChild}
                  parentTitle={parentTitle}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    );
  }

  if (item.title) {
    return (
      <SidebarMenuSubItem className="w-full">
        <SidebarMenuSubButton
          id={`nav-sub-button-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
          className={cn(
            "w-full rounded-md transition-colors",
            activeChild === item.title ? "bg-sidebar-accent! text-foreground!" : ""
          )}
          isActive={activeChild === item.title}
          onClick={() => {
            setActiveParent(parentTitle || "");
            setActiveChild(item.title!);
          }}
          render={<Link href={item.href ?? "#"}>{item.title}</Link>}
        />
      </SidebarMenuSubItem>
    );
  }

  return null;
}
