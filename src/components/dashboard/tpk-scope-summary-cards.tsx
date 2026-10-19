import { BriefcaseBusiness, Users, UsersRound } from "lucide-react";

import type { DataSource } from "@/lib/data/types";
import { formatNumber } from "@/lib/map-data";

export function TpkScopeSummaryCards({
  tim,
  anggota,
  pkb,
  scopeLabel,
  dataSource = "mock",
}: {
  tim: number;
  anggota: number;
  pkb: number;
  scopeLabel: string;
  dataSource?: DataSource | null;
}) {
  const pkbHint =
    dataSource === "postgres"
      ? "PKB/PLKB unik (live)"
      : dataSource === "mock"
        ? "PKB/PLKB unik (simulasi)"
        : "PKB/PLKB unik";

  const cards = [
    {
      id: "tim",
      label: "Jumlah Tim TPK",
      value: tim,
      unit: "tim",
      hint: `Di ${scopeLabel}`,
      icon: UsersRound,
      color: "bg-blue-50 text-primary",
    },
    {
      id: "anggota",
      label: "Jumlah Anggota TPK",
      value: anggota,
      unit: "orang",
      hint: "Total personel di daftar",
      icon: Users,
      color: "bg-cyan-50 text-cyan-700",
    },
    {
      id: "pkb",
      label: "Jumlah PKB",
      value: pkb,
      unit: "petugas",
      hint: pkbHint,
      icon: BriefcaseBusiness,
      color: "bg-violet-50 text-violet-700",
    },
  ] as const;

  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      aria-label={`Ringkasan TPK ${scopeLabel}`}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.id}
            className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[var(--shadow-soft)] sm:px-6 sm:py-6"
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
            <div className="mt-1.5 text-[11px] text-slate-400">{card.hint}</div>
          </article>
        );
      })}
    </div>
  );
}
