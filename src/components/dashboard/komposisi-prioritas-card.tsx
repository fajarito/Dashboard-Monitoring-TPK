"use client";

import { useEffect, useState } from "react";

import type { PrioritasSlice } from "@/lib/sasaran-indikator";
import { formatNumber } from "@/lib/map-data";

export function KomposisiPrioritasCard({
  scopeLabel,
  total,
  slices,
  compact = false,
}: {
  scopeLabel: string;
  total: number;
  slices: PrioritasSlice[];
  /** Versi ringkas untuk kolom samping peta. */
  compact?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [scopeLabel, total]);

  return (
    <section
      className="design-card relative overflow-hidden p-6 sm:p-7"
      aria-label={`Komposisi keluarga sasaran berdasarkan prioritas ${scopeLabel}`}
    >
      {!compact ? (
        <div
          className="pointer-events-none absolute -top-14 -left-10 size-32 rounded-full bg-blue-100/40 blur-3xl"
          aria-hidden
        />
      ) : null}
      <div className="relative flex flex-wrap items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="eyebrow">Keluarga sasaran</div>
          <h2
            className={
              compact
                ? "mt-0.5 text-[15px] font-extrabold tracking-tight text-navy"
                : "mt-1 text-base font-extrabold tracking-tight text-navy"
            }
          >
            {compact ? "Komposisi prioritas" : "Komposisi berdasarkan prioritas"}
          </h2>
          <p
            className={
              compact
                ? "mt-0 text-[11px] text-muted-foreground"
                : "mt-0.5 text-xs text-muted-foreground"
            }
          >
            {compact
              ? `Prioritas 1–4 · ${scopeLabel}`
              : `Prioritas 1–4 dan bukan prioritas · ${scopeLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={
              compact
                ? "rounded-lg bg-slate-50 px-2 py-1 text-right ring-1 ring-line"
                : "rounded-xl bg-slate-50 px-2.5 py-1.5 text-right ring-1 ring-line"
            }
          >
            <span className="block text-[9px] font-bold tracking-wider text-slate-400 uppercase">
              Total
            </span>
            <span
              className={
                compact
                  ? "text-[13px] font-extrabold tabular-nums text-navy"
                  : "text-sm font-extrabold tabular-nums text-navy"
              }
            >
              {formatNumber(total)}
            </span>
          </span>
          {!compact ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
          ) : null}
        </div>
      </div>

      <ul
        className={
          "relative mt-5 space-y-3"
        }
        role="list"
      >
        {slices.map((slice, index) => (
          <li key={slice.id}>
            <div
              className={
                compact
                  ? "mb-0.5 flex items-baseline justify-between gap-2"
                  : "mb-1 flex items-baseline justify-between gap-3"
              }
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden
                />
                <span
                  className={
                    compact
                      ? "truncate text-[11px] font-bold text-ink"
                      : "truncate text-[13px] font-bold text-ink"
                  }
                >
                  {slice.label}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span
                  className={
                    compact
                      ? "text-[11px] font-extrabold text-navy"
                      : "text-[13px] font-extrabold text-navy"
                  }
                >
                  {formatNumber(slice.value)}
                </span>
                <span
                  className={
                    compact
                      ? "ml-1.5 text-[11px] font-bold text-primary"
                      : "ml-2 text-[12px] font-bold text-primary"
                  }
                >
                  {slice.percent.toLocaleString("id-ID", {
                    maximumFractionDigits: 0,
                  })}
                  %
                </span>
              </span>
            </div>
            <div
              className={
                compact
                  ? "h-1.5 overflow-hidden rounded-full bg-slate-100"
                  : "h-2.5 overflow-hidden rounded-full bg-slate-100"
              }
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: revealed ? `${slice.percent}%` : "0%",
                  backgroundColor: slice.color,
                  transitionDelay: `${90 + index * 70}ms`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
