"use client";

import {
  AlertTriangle,
  BriefcaseBusiness,
  Users,
  UsersRound,
} from "lucide-react";

import type { DataSource } from "@/lib/data";
import type { MetricKey } from "@/lib/map-data";
import { formatNumber } from "@/lib/map-data";
import { indicatorTitle } from "@/lib/map-indicator";
import { cn } from "@/lib/utils";

type WilayahMapKpiCardsProps = {
  jumlahTPK: number;
  jumlahAnggota: number;
  jumlahPKB: number;
  jumlahKRS: number;
  scopeLabel: string;
  dataSource: DataSource | null;
  /** Indikator peta aktif — klik kartu mengganti choropleth (sama home). */
  activeMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
};

/**
 * KPI ringkasan wilayah yang juga mengontrol indikator peta (spek Fajar).
 */
export function WilayahMapKpiCards({
  jumlahTPK,
  jumlahAnggota,
  jumlahPKB,
  jumlahKRS,
  scopeLabel,
  dataSource,
  activeMetric,
  onMetricChange,
}: WilayahMapKpiCardsProps) {
  const sourceHint =
    dataSource === "postgres"
      ? "live"
      : dataSource === "mock"
        ? "simulasi"
        : "agregat";

  const cards = [
    {
      key: "tpk" as const,
      label: "Jumlah Tim TPK",
      value: jumlahTPK,
      unit: "tim",
      hint: `Di ${scopeLabel}`,
      icon: UsersRound,
      color: "bg-blue-50 text-primary",
    },
    {
      key: "anggota" as const,
      label: "Jumlah Anggota TPK",
      value: jumlahAnggota,
      unit: "orang",
      hint: `Personel (${sourceHint})`,
      icon: Users,
      color: "bg-cyan-50 text-cyan-700",
    },
    {
      key: "pkb" as const,
      label: "Jumlah PKB",
      value: jumlahPKB,
      unit: "petugas",
      hint: `PKB/PLKB unik (${sourceHint})`,
      icon: BriefcaseBusiness,
      color: "bg-violet-50 text-violet-700",
    },
    {
      key: "krs" as const,
      label: "KRS di wilayah ini",
      value: jumlahKRS,
      unit: "keluarga",
      hint: `Berisiko stunting (${sourceHint})`,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-800",
    },
  ];

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={`Ringkasan ${scopeLabel} · pilih indikator peta`}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const active = activeMetric === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() => onMetricChange(card.key)}
            aria-pressed={active}
            title={`Warna peta: ${indicatorTitle(card.key)}`}
            className={cn(
              "rounded-2xl border bg-white px-5 py-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:px-6 sm:py-6",
              active
                ? "border-blue-400 ring-2 ring-blue-100"
                : "border-line",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {card.label}
              </div>
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-xl ${card.color}`}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-navy tabular-nums">
                {formatNumber(card.value)}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {card.unit}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>{card.hint}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase",
                  active
                    ? "bg-blue-50 text-primary"
                    : "bg-slate-50 text-slate-400",
                )}
              >
                {active ? "Aktif" : "Pilih"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
