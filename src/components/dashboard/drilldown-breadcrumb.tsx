import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

export function DrilldownBreadcrumb({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Jejak navigasi" className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3.5 text-slate-300" aria-hidden />
            ) : null}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "text-[11px] font-bold",
                  last ? "text-navy" : "text-muted-foreground",
                )}
                aria-current={last ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
