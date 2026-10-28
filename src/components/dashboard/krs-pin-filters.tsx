"use client";

import { MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";
import { KRS_PIN_COLORS, KRS_PIN_LABELS } from "@/lib/krs-pin-style";
import { sasaranShortLabels } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

const INDIKATOR_FILTERS: {
  key: TpkKeluargaIndikatorFilter;
  label: string;
}[] = [
  { key: "krs", label: "KRS" },
  { key: "ibuHamil", label: sasaranShortLabels.ibuHamil },
  { key: "baduta", label: sasaranShortLabels.baduta },
  { key: "balita", label: sasaranShortLabels.balita },
  { key: "jambanTidakLayak", label: sasaranShortLabels.jambanTidakLayak },
  {
    key: "sumberAirTidakLayak",
    label: sasaranShortLabels.sumberAirTidakLayak,
  },
];

const PRIORITAS_FILTERS: TpkKeluargaPrioritas[] = [
  "p1",
  "p2",
  "p3",
  "p4",
  "bukan",
  "tidakRisiko",
];

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export type KrsPinFiltersProps = {
  prioritas: TpkKeluargaPrioritas[];
  indikator: TpkKeluargaIndikatorFilter[];
  validCoordsOnly: boolean;
  q: string;
  onPrioritasChange: (next: TpkKeluargaPrioritas[]) => void;
  onIndikatorChange: (next: TpkKeluargaIndikatorFilter[]) => void;
  onValidCoordsOnlyChange: (next: boolean) => void;
  onQChange: (next: string) => void;
  status: "idle" | "loading" | "ready" | "empty" | "error";
  returned: number;
  total: number;
  truncated: boolean;
  error: string | null;
  onRetry?: () => void;
};

/**
 * Filter overlay pin KRS — hanya di tingkat desa/kelurahan.
 * Tidak memblok choropleth (status async terpisah).
 */
export function KrsPinFilters({
  prioritas,
  indikator,
  validCoordsOnly,
  q,
  onPrioritasChange,
  onIndikatorChange,
  onValidCoordsOnlyChange,
  onQChange,
  status,
  returned,
  total,
  truncated,
  error,
  onRetry,
}: KrsPinFiltersProps) {
  return (
    <div className="mx-6 mt-3 rounded-xl border border-line bg-slate-50/80 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 grid size-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
            <MapPin className="size-3.5" aria-hidden />
          </span>
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.12em] text-amber-800 uppercase">
              Pin keluarga / KRS
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Hanya dalam batas kelurahan aktif · cluster otomatis
            </p>
          </div>
        </div>
        <div className="text-[11px] font-semibold text-slate-600">
          {status === "loading" ? (
            <span className="text-slate-400">Memuat pin…</span>
          ) : status === "error" ? (
            <span className="text-rose-600">
              Gagal memuat pin
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ml-2 underline"
                >
                  Coba lagi
                </button>
              ) : null}
            </span>
          ) : status === "empty" ? (
            <span className="text-slate-400">Tidak ada pin cocok filter</span>
          ) : status === "ready" ? (
            <span>
              {returned.toLocaleString("id-ID")}
              {truncated || total > returned
                ? ` / ${total.toLocaleString("id-ID")}`
                : ""}{" "}
              pin
              {truncated ? " (terpotong)" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {status === "error" && error ? (
        <p className="mt-2 text-[11px] text-rose-600">{error}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter prioritas">
        {PRIORITAS_FILTERS.map((key) => {
          const on = prioritas.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onPrioritasChange(toggleValue(prioritas, key))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                on
                  ? "border-slate-300 bg-white text-navy ring-2 ring-slate-100"
                  : "border-transparent bg-white/70 text-slate-500 hover:border-line",
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: KRS_PIN_COLORS[key] }}
                aria-hidden
              />
              {KRS_PIN_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter indikator">
        {INDIKATOR_FILTERS.map((item) => {
          const on = indikator.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onIndikatorChange(toggleValue(indikator, item.key))
              }
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                on
                  ? "border-amber-300 bg-amber-50 text-amber-900 ring-2 ring-amber-100"
                  : "border-transparent bg-white/70 text-slate-500 hover:border-line",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-[12rem] flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-2.5 size-3.5 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="Cari nama KK…"
            className="h-8 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-[11px] text-navy outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            aria-label="Cari nama kepala keluarga"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={validCoordsOnly}
            onChange={(e) => onValidCoordsOnlyChange(e.target.checked)}
            className="size-3.5 rounded border-line accent-amber-600"
          />
          Hanya koordinat valid
        </label>
        {(prioritas.length > 0 ||
          indikator.join(",") !== "krs" ||
          q.trim() ||
          !validCoordsOnly) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px]"
            onClick={() => {
              onPrioritasChange([]);
              onIndikatorChange(["krs"]);
              onQChange("");
              onValidCoordsOnlyChange(true);
            }}
          >
            Reset filter
          </Button>
        )}
      </div>
    </div>
  );
}
