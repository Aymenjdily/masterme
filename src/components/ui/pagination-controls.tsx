"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const selectClassName =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function PaginationControls({
  page,
  pageCount,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Rows per page</span>
        <select
          className={selectClassName}
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Page {page} of {pageCount} · {totalItems} item{totalItems === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
