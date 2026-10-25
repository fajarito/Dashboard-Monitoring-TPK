"use client";

import { BriefcaseBusiness, Scale } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import {
  formatNumber,
  formatRatioValue,
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  getPkbDesaBebanStatus,
  getTpkKrsBebanStatus,
  nationalDesaKelurahan,
  nationalTotals,
  KRS_PER_TPK_IDEAL_MAX,
  PKB_DESA_IDEAL_MAX,
  type RasioBebanStatus,
} from "@/lib/map-data";
import { cn } from "@/lib/utils";

export type RasioInsightValues = {
  jumlahTPK: number;
  jumlahKRS: number;
  jumlahPKB: number;
  rasioTPK_KRS: number;
  rasioPKB_desa: number;
  warningBeban: boolean;
  /** Jumlah desa untuk footnote / status; opsional. */
  jumlahDesa?: number;
  sourceLabel?: string;
};

export function RasioInsightPanels({
  values,
}: {
  /** Jika kosong, pakai agregat mock lokal (fallback UI). */
  values?: RasioInsightValues | null;
}) {
  const resolved = useMemo(() => {
    if (values) return values;
    const rasioTPK_KRS = getKrsPerTpkRatio(
      nationalTotals.tpk,
      nationalTotals.krs,
    );
    const rasioPKB_desa = getDesaPerPkbRatio(
      nationalTotals.pkb,
      nationalDesaKelurahan,
    );
    return {
      jumlahTPK: nationalTotals.tpk,
      jumlahKRS: nationalTotals.krs,
      jumlahPKB: nationalTotals.pkb,
      rasioTPK_KRS,
      rasioPKB_desa,
      warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
      jumlahDesa: nationalDesaKelurahan,
      sourceLabel: "simulasi",
    } satisfies RasioInsightValues;
  }, [values]);

  const krsPerTpkRounded = Math.round(resolved.rasioTPK_KRS);
  const desaLabel = resolved.jumlahDesa
    ? formatNumber(resolved.jumlahDesa)
    : null;
  const source = resolved.sourceLabel ?? "agregat";

  const tpkKrsStatus = getTpkKrsBebanStatus(
    resolved.jumlahTPK,
    resolved.jumlahKRS,
    resolved.rasioTPK_KRS,
  );
  const pkbDesaStatus = getPkbDesaBebanStatus(
    resolved.jumlahPKB,
    resolved.jumlahDesa ?? null,
    resolved.jumlahDesa != null
      ? resolved.rasioPKB_desa
      : Number.NaN,
  );
  // Jika jumlahDesa tidak dikirim tapi rasio API valid & PKB > 0, pakai rasio+warningBeban
  const pkbStatusResolved: RasioBebanStatus =
    resolved.jumlahDesa != null
      ? pkbDesaStatus
      : !Number.isFinite(resolved.jumlahPKB) || resolved.jumlahPKB <= 0
        ? "unavailable"
        : !Number.isFinite(resolved.rasioPKB_desa)
          ? "unavailable"
          : resolved.warningBeban || resolved.rasioPKB_desa > PKB_DESA_IDEAL_MAX
            ? "berat"
            : "terkendali";

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <RatioPanelShell
        ariaLabel="Rasio TPK terhadap keluarga berisiko stunting"
        icon={<Scale className="size-3" aria-hidden />}
        eyebrow="Rasio TPK : KRS"
        description="Rata-rata keluarga berisiko stunting per tim"
        leftLabel="1 TPK"
        heroValue={formatNumber(krsPerTpkRounded)}
        heroUnit="KRS"
        heroTone={statusToTone(tpkKrsStatus)}
        footnote={`Dari ${formatNumber(resolved.jumlahTPK)} TPK · ${formatNumber(resolved.jumlahKRS)} KRS · ${source}`}
        status={
          <StatusChip
            status={tpkKrsStatus}
            detail={
              tpkKrsStatus === "unavailable"
                ? "Data tidak valid"
                : tpkKrsStatus === "berat"
                  ? `> ${KRS_PER_TPK_IDEAL_MAX} KRS/TPK`
                  : `≤ ${KRS_PER_TPK_IDEAL_MAX} KRS/TPK`
            }
          />
        }
      />

      <RatioPanelShell
        ariaLabel="Rasio PKB terhadap desa atau kelurahan"
        icon={<BriefcaseBusiness className="size-3" aria-hidden />}
        eyebrow="Rasio PKB : Desa/Kelurahan"
        description="Rata-rata desa/kelurahan yang dibina satu PKB"
        leftLabel="1 PKB"
        heroValue={formatRatioValue(resolved.rasioPKB_desa, 1)}
        heroUnit="desa"
        heroTone={statusToTone(pkbStatusResolved)}
        footnote={
          desaLabel
            ? `Dari ${formatNumber(resolved.jumlahPKB)} PKB · ${desaLabel} desa · ${source}`
            : `Dari ${formatNumber(resolved.jumlahPKB)} PKB · ${source}`
        }
        status={
          <StatusChip
            status={pkbStatusResolved}
            detail={
              pkbStatusResolved === "unavailable"
                ? "Data tidak valid"
                : pkbStatusResolved === "berat"
                  ? `> ${PKB_DESA_IDEAL_MAX} desa/PKB`
                  : `≤ ${PKB_DESA_IDEAL_MAX} desa/PKB`
            }
          />
        }
      />
    </div>
  );
}

function statusToTone(status: RasioBebanStatus): "calm" | "warm" | "muted" {
  if (status === "berat") return "warm";
  if (status === "unavailable") return "muted";
  return "calm";
}

function statusLabel(status: RasioBebanStatus): string {
  if (status === "berat") return "Beban Berat";
  if (status === "unavailable") return "Data Tidak Tersedia";
  return "Beban Terkendali";
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
  heroTone?: "calm" | "warm" | "muted";
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
            ? "from-orange-500 via-orange-400 to-amber-200"
            : heroTone === "muted"
              ? "from-slate-400 via-slate-300 to-slate-200"
              : "from-emerald-500 via-emerald-400 to-teal-200",
        )}
        aria-hidden
      />

      <div className="relative flex items-center gap-3 px-5 py-4 pl-5 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full ring-1",
              heroTone === "warm"
                ? "bg-orange-50 text-[#EA580C] ring-orange-100"
                : heroTone === "muted"
                  ? "bg-slate-50 text-[#64748B] ring-slate-100"
                  : "bg-emerald-50 text-[#059669] ring-emerald-100",
            )}
          >
            {icon}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "text-[9px] font-extrabold tracking-[0.14em] uppercase",
                  heroTone === "warm"
                    ? "text-[#EA580C]"
                    : heroTone === "muted"
                      ? "text-[#64748B]"
                      : "text-[#059669]",
                )}
              >
                {eyebrow}
              </span>
              {status}
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <span className="text-[12px] font-bold tracking-tight text-[#64748B] tabular-nums">
                {leftLabel}
              </span>
              <span className="text-sm font-semibold text-slate-300" aria-hidden>
                :
              </span>
              <span
                className={cn(
                  "text-[1.45rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-[1.55rem]",
                  heroTone === "warm"
                    ? "text-[#EA580C]"
                    : heroTone === "muted"
                      ? "text-[#64748B]"
                      : "text-[#15315D]",
                )}
              >
                {heroValue}
              </span>
              <span
                className={cn(
                  "rounded px-1 py-px text-[9px] font-extrabold tracking-[0.06em] uppercase",
                  heroTone === "warm"
                    ? "bg-orange-50 text-[#EA580C]"
                    : heroTone === "muted"
                      ? "bg-slate-50 text-[#64748B]"
                      : "bg-emerald-50 text-[#059669]",
                )}
              >
                {heroUnit}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] leading-snug text-[#64748B]">
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
  status,
  detail,
}: {
  status: RasioBebanStatus;
  detail: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide uppercase",
        status === "berat"
          ? "bg-orange-50 text-[#EA580C]"
          : status === "unavailable"
            ? "bg-slate-100 text-[#64748B]"
            : "bg-emerald-50 text-[#059669]",
      )}
      title={detail}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          status === "berat"
            ? "bg-[#EA580C]"
            : status === "unavailable"
              ? "bg-[#64748B]"
              : "bg-[#059669]",
        )}
        aria-hidden
      />
      {statusLabel(status)}
    </span>
  );
}
