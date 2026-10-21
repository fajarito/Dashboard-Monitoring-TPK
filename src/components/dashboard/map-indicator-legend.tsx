"use client";

import type { LegendItem } from "@/lib/map-indicator";
import { indicatorTitle } from "@/lib/map-indicator";
import type { ChoroplethMetric } from "@/lib/map-choropleth";
import { cn } from "@/lib/utils";

type MapIndicatorLegendProps = {
  metric: ChoroplethMetric;
  items: LegendItem[];
  className?: string;
};

/**
 * Kartu legenda dinamis — kanan bawah peta (spek §6).
 */
export function MapIndicatorLegend({
  metric,
  items,
  className,
}: MapIndicatorLegendProps) {
  return (
    <aside
      className={cn(
        "pointer-events-none absolute right-3 bottom-14 z-[500] w-[min(100%-1.5rem,220px)] rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:bottom-16 sm:right-4",
        className,
      )}
      aria-label="Legenda indikator peta"
    >
      <p className="text-[10px] font-extrabold tracking-wide text-slate-800 uppercase">
        {indicatorTitle(metric)}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={`${item.label}-${item.color}`}
            className="flex items-start gap-2 text-[10px] leading-tight"
          >
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm border border-black/5"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="font-bold text-slate-700">{item.label}</span>
              {item.range && item.range !== "—" ? (
                <span className="mt-0.5 block text-[9px] font-medium text-slate-500">
                  {item.range}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
