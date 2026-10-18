"use client";

import { useEffect, useState } from "react";

import { formatNumber } from "@/lib/map-data";
import type { PrioritasSlice } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

function buildConic(slices: PrioritasSlice[]) {
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "conic-gradient(#e2e8f0 0deg 360deg)";
  let cursor = 0;
  const parts: string[] = [];
  for (const slice of slices) {
    const deg = (slice.value / total) * 360;
    const start = cursor;
    const end = cursor + deg;
    parts.push(`${slice.color} ${start}deg ${end}deg`);
    cursor = end;
  }
  return `conic-gradient(${parts.join(", ")})`;
}

export function TpkPrioritasDonut({
  tpkName,
  total,
  slices,
}: {
  tpkName: string;
  total: number;
  slices: PrioritasSlice[];
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [tpkName, total]);

  const gradient = buildConic(slices);

  return (
    <section
      className="design-card relative overflow-hidden p-6 sm:p-7"
      aria-label={`Komposisi prioritas keluarga ${tpkName}`}
    >
      <div
        className="pointer-events-none absolute -top-14 -right-10 size-32 rounded-full bg-blue-100/50 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow">Keluarga binaan</div>
          <h2 className="mt-1 text-base font-extrabold tracking-tight text-navy">
            Prioritas keluarga
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Prioritas 1–4 dan bukan prioritas · {tpkName}
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-amber-700 uppercase">
          Data simulasi
        </span>
      </div>

      <div className="relative mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div
          className={cn(
            "relative size-[9rem] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(21,94,239,0.08)] transition-[transform,opacity] duration-700 ease-out",
            revealed ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
          style={{ background: gradient }}
          role="img"
          aria-label={`Donut prioritas: ${slices
            .map(
              (s) =>
                `${s.label} ${s.percent.toLocaleString("id-ID", { maximumFractionDigits: 0 })}%`,
            )
            .join(", ")}`}
        >
          <div className="absolute inset-[18%] grid place-items-center rounded-full bg-white text-center shadow-[0_8px_24px_rgba(16,42,86,0.06)]">
            <div>
              <div className="text-xl font-extrabold tracking-tight text-navy tabular-nums">
                {formatNumber(total)}
              </div>
              <div className="mt-0.5 text-[9px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Keluarga
              </div>
            </div>
          </div>
        </div>

        <ul className="min-w-0 w-full flex-1 space-y-2.5" role="list">
          {slices.map((slice, index) => (
            <li key={slice.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  <span className="truncate text-[13px] font-bold text-ink">
                    {slice.label}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-[13px] font-extrabold text-navy">
                    {formatNumber(slice.value)}
                  </span>
                  <span className="ml-2 text-[12px] font-bold text-primary">
                    {slice.percent.toLocaleString("id-ID", {
                      maximumFractionDigits: 0,
                    })}
                    %
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: revealed ? `${slice.percent}%` : "0%",
                    backgroundColor: slice.color,
                    transitionDelay: `${100 + index * 70}ms`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
