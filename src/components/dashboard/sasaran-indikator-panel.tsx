"use client";

import {
  AlertTriangle,
  Baby,
  Droplets,
  Home,
  type LucideIcon,
  PersonStanding,
  ShowerHead,
  UsersRound,
  Venus,
} from "lucide-react";

import { GlossaryTerm } from "@/components/dashboard/glossary-term";
import type { DataSource } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranLabels,
  type SasaranCounts,
  type SasaranKey,
} from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

const sasaranGlossaryId: Record<SasaranKey, string> = {
  ibuHamil: "ibu-hamil",
  baduta: "baduta",
  balita: "balita",
  jambanTidakLayak: "jamban-tl",
  sumberAirTidakLayak: "air-tl",
  rtlh: "rtlh",
};

const sasaranMeta: Record<
  SasaranKey,
  { icon: LucideIcon; color: string }
> = {
  ibuHamil: {
    icon: Venus,
    color: "bg-rose-50 text-rose-700",
  },
  baduta: {
    icon: Baby,
    color: "bg-sky-50 text-sky-700",
  },
  balita: {
    icon: PersonStanding,
    color: "bg-cyan-50 text-cyan-700",
  },
  jambanTidakLayak: {
    icon: ShowerHead,
    color: "bg-amber-50 text-amber-700",
  },
  sumberAirTidakLayak: {
    icon: Droplets,
    color: "bg-blue-50 text-blue-700",
  },
  rtlh: {
    icon: Home,
    color: "bg-orange-50 text-orange-700",
  },
};

type ExtraCard = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
};

function IndikatorCard({
  label,
  value,
  scopeLabel,
  icon: Icon,
  color,
  glossaryId,
}: {
  label: string;
  value: number;
  scopeLabel: string;
  icon: LucideIcon;
  color: string;
  glossaryId?: string;
}) {
  return (
    <article className="rounded-2xl border border-line bg-white px-5 py-4 shadow-[var(--shadow-soft)] sm:px-5 sm:py-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[10px] leading-snug font-semibold tracking-[0.08em] text-slate-400 uppercase">
          {glossaryId ? (
            <GlossaryTerm termId={glossaryId} className="text-slate-400 uppercase">
              {label}
            </GlossaryTerm>
          ) : (
            label
          )}
        </div>
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full ${color}`}
        >
          <Icon className="size-3" aria-hidden />
        </span>
      </div>
      <div className="mt-2.5 text-[1.35rem] leading-none font-extrabold tracking-tight text-navy tabular-nums sm:text-[1.5rem]">
        {formatNumber(value)}
      </div>
      <div className="mt-2 text-[9px] font-medium text-slate-400">
        {scopeLabel}
      </div>
    </article>
  );
}

export function SasaranIndikatorPanel({
  scopeLabel,
  counts,
  keluargaSasaran,
  krs,
  dataSource = "mock",
}: {
  scopeLabel: string;
  counts: SasaranCounts;
  /** Opsional — ditampilkan di detail TPK sebelum 6 indikator. */
  keluargaSasaran?: number;
  /** Keluarga Berisiko Stunting — ejaan Berisiko. */
  krs?: number;
  /**
   * Sumber efektif dari meta.source API (home nasional).
   * Default mock — halaman drilldown wilayah masih simulasi lokal.
   */
  dataSource?: DataSource | null;
}) {
  const extras: ExtraCard[] = [];
  if (keluargaSasaran != null) {
    extras.push({
      id: "keluargaSasaran",
      label: "Keluarga Sasaran",
      value: keluargaSasaran,
      icon: UsersRound,
      color: "bg-indigo-50 text-indigo-700",
    });
  }
  if (krs != null) {
    extras.push({
      id: "krs",
      label: "Keluarga Berisiko Stunting",
      value: krs,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-800",
    });
  }

  const hasExtras = extras.length > 0;
  const sourceBadge = resolveSourceBadge(dataSource);

  return (
    <section aria-label={`Indikator sasaran ${scopeLabel}`}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            Indikator sasaran
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Keluarga & lingkungan · agregat{" "}
            <span className="font-semibold text-navy">{scopeLabel}</span>
          </p>
        </div>
        {sourceBadge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
              sourceBadge.className,
            )}
          >
            {sourceBadge.label}
          </span>
        ) : null}
      </div>

      <div
        className={
          hasExtras
            ? "grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-4"
            : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
        }
      >
        {extras.map((item) => (
          <IndikatorCard
            key={item.id}
            label={item.label}
            value={item.value}
            scopeLabel={scopeLabel}
            icon={item.icon}
            color={item.color}
            glossaryId={
              item.id === "krs"
                ? "krs"
                : item.id === "keluargaSasaran"
                  ? "keluarga-sasaran"
                  : undefined
            }
          />
        ))}
        {sasaranKeys.map((key) => {
          const meta = sasaranMeta[key];
          return (
            <IndikatorCard
              key={key}
              label={sasaranLabels[key]}
              value={counts[key]}
              scopeLabel={scopeLabel}
              icon={meta.icon}
              color={meta.color}
              glossaryId={sasaranGlossaryId[key]}
            />
          );
        })}
      </div>
    </section>
  );
}
