"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildConicGradient,
  formatKomposisiPercent,
  getKomposisiPercent,
  komposisiPilar,
  komposisiTotalAnggota,
  type KomposisiPillar,
} from "@/lib/komposisi-data";
import { formatNumber } from "@/lib/map-data";
import { cn } from "@/lib/utils";

export type KomposisiTpkCounts = {
  bidan: number;
  pkk: number;
  kaderKb: number;
};

type KomposisiTpkCardProps = {
  /** `full` untuk halaman Komposisi; `compact` di bawah peta. */
  variant?: "full" | "compact";
  className?: string;
  showDetailLink?: boolean;
  /** Override dari API ringkasan; fallback ke data simulasi lokal. */
  counts?: KomposisiTpkCounts | null;
};

function pillarsFromCounts(counts: KomposisiTpkCounts): KomposisiPillar[] {
  const byId: Record<KomposisiPillar["id"], number> = {
    nakes: counts.bidan,
    pkk: counts.pkk,
    kb: counts.kaderKb,
  };
  return komposisiPilar.map((item) => ({
    ...item,
    value: byId[item.id],
  }));
}

export function KomposisiTpkCard({
  variant = "full",
  className,
  showDetailLink = false,
  counts = null,
}: KomposisiTpkCardProps) {
  const [revealed, setRevealed] = useState(false);

  const pillars = useMemo(
    () => (counts ? pillarsFromCounts(counts) : komposisiPilar),
    [counts],
  );
  const totalAnggota = useMemo(
    () => pillars.reduce((sum, item) => sum + item.value, 0),
    [pillars],
  );
  const totalLabel = formatNumber(totalAnggota);

  useEffect(() => {
    setRevealed(false);
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [totalAnggota]);

  const compact = variant === "compact";
  const gradient = buildConicGradient(pillars, totalAnggota);

  return (
    <section
      className={cn(
        "design-card relative overflow-hidden p-6 sm:p-7",
        className,
      )}
      aria-labelledby="komposisi-tpk-title"
    >
      {!compact ? (
        <div
          className="pointer-events-none absolute -top-20 -right-16 size-44 rounded-full bg-blue-100/60 blur-3xl"
          aria-hidden
        />
      ) : null}

      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="eyebrow">Tiga pilar TPK</div>
          <h2
            id="komposisi-tpk-title"
            className={cn(
              "font-extrabold tracking-tight text-navy",
              compact ? "mt-0.5 text-[15px]" : "mt-1 section-title text-lg",
            )}
          >
            Komposisi TPK
          </h2>
          {!compact ? (
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Porsi anggota nasional menurut peran: tenaga kesehatan, kader PKK,
              dan kader KB/PPKBD.
            </p>
          ) : null}
        </div>
        {showDetailLink ? (
          <Link
            href="/komposisi"
            className={cn(
              "shrink-0 border border-line bg-white font-bold text-primary transition-colors hover:border-blue-300 hover:bg-blue-50",
              compact
                ? "rounded-lg px-2 py-1 text-[10px]"
                : "rounded-xl px-3 py-1.5 text-[11px]",
            )}
          >
            Selengkapnya
          </Link>
        ) : (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-primary">
            Data simulasi
          </span>
        )}
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center",
          compact
            ? "mt-5 gap-5 sm:flex-row sm:items-center sm:gap-5"
            : "mt-5 gap-6 lg:flex-row lg:items-center lg:gap-8",
        )}
      >
        <div
          className={cn(
            "relative shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(21,94,239,0.08)] transition-[transform,opacity] duration-700 ease-out",
            compact ? "size-[7.5rem]" : "size-40 sm:size-44",
            revealed ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
          style={{ background: gradient }}
          role="img"
          aria-label={`Donut komposisi TPK: ${pillars
            .map(
              (item) =>
                `${item.label} ${formatKomposisiPercent(item.value, totalAnggota)}`,
            )
            .join(", ")}`}
        >
          <div
            className={cn(
              "absolute grid place-items-center rounded-full bg-white text-center shadow-[0_8px_24px_rgba(16,42,86,0.06)]",
              compact ? "inset-[15%]" : "inset-[16%]",
            )}
          >
            <div>
              <div
                className={cn(
                  "font-extrabold tracking-tight text-navy tabular-nums",
                  compact ? "text-base" : "text-2xl sm:text-[1.65rem]",
                )}
              >
                {totalLabel}
              </div>
              <div
                className={cn(
                  "font-bold tracking-[0.12em] text-slate-400 uppercase",
                  compact ? "mt-0 text-[8px]" : "mt-0.5 text-[9px]",
                )}
              >
                Total anggota
              </div>
            </div>
          </div>
        </div>

        <ul
          className={cn(
            "min-w-0 w-full flex-1",
            compact ? "space-y-3" : "space-y-3.5",
          )}
          role="list"
        >
          {pillars.map((item, index) => {
            const percent = getKomposisiPercent(item.value, totalAnggota);
            return (
              <li key={item.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "shrink-0 rounded-full",
                          compact ? "size-2" : "size-2.5",
                        )}
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "truncate font-bold text-ink",
                          compact ? "text-[12px]" : "text-[13px]",
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    {!compact ? (
                      <p className="mt-0.5 pl-[18px] text-[11px] text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "font-extrabold tabular-nums text-navy",
                        compact ? "text-[12px]" : "text-sm",
                      )}
                    >
                      {formatKomposisiPercent(item.value, totalAnggota)}
                    </div>
                    <div
                      className={cn(
                        "font-medium tabular-nums text-slate-400",
                        compact ? "text-[9px]" : "text-[10px]",
                      )}
                    >
                      {formatNumber(item.value)} orang
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "overflow-hidden rounded-full bg-slate-100",
                    compact ? "mt-1 h-1.5" : "mt-1.5 h-2",
                  )}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 ease-out",
                      item.trackClass,
                    )}
                    style={{
                      width: revealed ? `${percent}%` : "0%",
                      transitionDelay: `${120 + index * 90}ms`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {!compact ? (
        <p className="relative mt-5 rounded-xl bg-blue-50/80 px-3.5 py-3 text-[11px] leading-relaxed text-blue-900/80">
          <span className="font-bold text-primary">Catatan:</span> angka
          dijumlahkan dari anggota unik tiap TPK (total{" "}
          {formatNumber(counts ? totalAnggota : komposisiTotalAnggota)} orang).
          Proporsi tiga pilar bersifat simulasi untuk demo visual.
        </p>
      ) : null}
    </section>
  );
}
