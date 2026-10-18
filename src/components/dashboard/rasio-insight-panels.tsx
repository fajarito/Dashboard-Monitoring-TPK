"use client";

import { BriefcaseBusiness, Scale } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  formatNumber,
  formatRatioValue,
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  nationalDesaKelurahan,
  nationalTotals,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import { cn } from "@/lib/utils";

export function RasioInsightPanels() {
  const krsPerTpk = useMemo(
    () => getKrsPerTpkRatio(nationalTotals.tpk, nationalTotals.krs),
    [],
  );
  const desaPerPkb = useMemo(
    () => getDesaPerPkbRatio(nationalTotals.pkb, nationalDesaKelurahan),
    [],
  );
  const krsPerTpkRounded = Math.round(krsPerTpk);
  const pkbBebanBerat = desaPerPkb > PKB_DESA_IDEAL_MAX;

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <RatioPanelShell
        ariaLabel="Rasio TPK terhadap keluarga berisiko stunting"
        icon={<Scale className="size-3" aria-hidden />}
        eyebrow="Rasio TPK : KRS"
        description="Rata-rata keluarga berisiko stunting per tim"
        leftLabel="1 TPK"
        heroValue={formatNumber(krsPerTpkRounded)}
        heroUnit="KRS"
        footnote={`Dari ${formatNumber(nationalTotals.tpk)} TPK · ${formatNumber(nationalTotals.krs)} KRS · simulasi`}
      />

      <RatioPanelShell
        ariaLabel="Rasio PKB terhadap desa atau kelurahan"
        icon={<BriefcaseBusiness className="size-3" aria-hidden />}
        eyebrow="Rasio PKB : Desa/Kelurahan"
        description="Rata-rata desa/kelurahan yang dibina satu PKB"
        leftLabel="1 PKB"
        heroValue={formatRatioValue(desaPerPkb, 1)}
        heroUnit="desa"
        heroTone={pkbBebanBerat ? "warm" : "calm"}
        footnote={`Dari ${formatNumber(nationalTotals.pkb)} PKB · ${formatNumber(nationalDesaKelurahan)} desa · simulasi`}
        status={
          pkbBebanBerat ? (
            <StatusChip
              tone="warm"
              label="Beban berat"
              detail={`> ${PKB_DESA_IDEAL_MAX} desa/PKB`}
            />
          ) : (
            <StatusChip
              tone="calm"
              label="Aman"
              detail={`≤ ${PKB_DESA_IDEAL_MAX} desa/PKB`}
            />
          )
        }
      />
    </div>
  );
}

function RatioPanelShell({
  ariaLabel,
  icon,
  eyebrow,
  description,
  leftLabel,
  heroValue,
  heroUnit,
  heroTone = "calm",
  footnote,
  status,
}: {
  ariaLabel: string;
  icon: ReactNode;
  eyebrow: string;
  description: string;
  leftLabel: string;
  heroValue: string;
  heroUnit: string;
  heroTone?: "calm" | "warm";
  footnote: string;
  status?: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[#dfe7f3] bg-white shadow-[var(--shadow-soft)]"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b",
          heroTone === "warm"
            ? "from-amber-400 via-amber-300 to-orange-200"
            : "from-primary via-[#3b82f6] to-[#93c5fd]",
        )}
        aria-hidden
      />

      <div className="relative flex items-center gap-3 px-5 py-5 pl-5 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full ring-1",
              heroTone === "warm"
                ? "bg-amber-50 text-amber-700 ring-amber-100"
                : "bg-blue-50 text-primary ring-blue-100",
            )}
          >
            {icon}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "text-[9px] font-extrabold tracking-[0.14em] uppercase",
                  heroTone === "warm" ? "text-amber-700" : "text-primary",
                )}
              >
                {eyebrow}
              </span>
              {status}
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <span className="text-[12px] font-bold tracking-tight text-slate-400 tabular-nums">
                {leftLabel}
              </span>
              <span className="text-sm font-semibold text-slate-300" aria-hidden>
                :
              </span>
              <span
                className={cn(
                  "text-[1.45rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-[1.55rem]",
                  heroTone === "warm" ? "text-amber-900" : "text-navy",
                )}
              >
                {heroValue}
              </span>
              <span
                className={cn(
                  "rounded px-1 py-px text-[9px] font-extrabold tracking-[0.06em] uppercase",
                  heroTone === "warm"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-primary",
                )}
              >
                {heroUnit}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] leading-snug text-slate-400">
              <span className="sm:hidden">{description}</span>
              <span className="hidden sm:inline">{footnote}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  tone,
  label,
  detail,
}: {
  tone: "calm" | "warm";
  label: string;
  detail: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide uppercase",
        tone === "warm"
          ? "bg-amber-50 text-amber-800"
          : "bg-emerald-50 text-emerald-800",
      )}
      title={detail}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          tone === "warm" ? "bg-amber-500" : "bg-emerald-500",
        )}
        aria-hidden
      />
      {label}
      <span className="font-semibold normal-case tracking-normal opacity-75">
        {detail}
      </span>
    </span>
  );
}
