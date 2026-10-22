"use client";

import { useMemo, useState } from "react";
import { HeartHandshake, MapPin } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { Button } from "@/components/ui/button";
import type {
  TpkKeluargaIndikatorFilter,
  TpkKeluargaItem,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { useTpkKeluarga } from "@/lib/hooks/use-tpk-keluarga";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranShortLabels,
  type SasaranKey,
} from "@/lib/sasaran-indikator";
import { formatAgregatDesaCaption } from "@/lib/tpk-display-name";
import { googleMapsSearchUrl, prioritasLabels } from "@/lib/tpk-drilldown-data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const INDIKATOR_FILTERS: {
  key: TpkKeluargaIndikatorFilter;
  label: string;
  chipClass: string;
}[] = [
  {
    key: "krs",
    label: "KRS",
    chipClass:
      "data-[on=true]:bg-amber-50 data-[on=true]:text-amber-800 data-[on=true]:ring-amber-200",
  },
  {
    key: "ibuHamil",
    label: sasaranShortLabels.ibuHamil,
    chipClass:
      "data-[on=true]:bg-rose-50 data-[on=true]:text-rose-700 data-[on=true]:ring-rose-200",
  },
  {
    key: "baduta",
    label: sasaranShortLabels.baduta,
    chipClass:
      "data-[on=true]:bg-blue-50 data-[on=true]:text-primary data-[on=true]:ring-blue-200",
  },
  {
    key: "balita",
    label: sasaranShortLabels.balita,
    chipClass:
      "data-[on=true]:bg-cyan-50 data-[on=true]:text-cyan-800 data-[on=true]:ring-cyan-200",
  },
  {
    key: "jambanTidakLayak",
    label: sasaranShortLabels.jambanTidakLayak,
    chipClass:
      "data-[on=true]:bg-amber-50 data-[on=true]:text-amber-800 data-[on=true]:ring-amber-200",
  },
  {
    key: "sumberAirTidakLayak",
    label: sasaranShortLabels.sumberAirTidakLayak,
    chipClass:
      "data-[on=true]:bg-sky-50 data-[on=true]:text-sky-800 data-[on=true]:ring-sky-200",
  },
];

const PRIORITAS_FILTERS: { key: TpkKeluargaPrioritas; label: string }[] = [
  { key: "p1", label: "P1" },
  { key: "p2", label: "P2" },
  { key: "p3", label: "P3" },
  { key: "p4", label: "P4" },
  { key: "bukan", label: "Bukan prioritas" },
  { key: "tidakRisiko", label: "Tidak berisiko" },
];

const CHIP_INDIKATOR_KEYS: SasaranKey[] = [
  "ibuHamil",
  "baduta",
  "balita",
  "jambanTidakLayak",
  "sumberAirTidakLayak",
];

function mapsHref(item: TpkKeluargaItem): string | null {
  if (item.latitude != null && item.longitude != null) {
    return googleMapsSearchUrl(`${item.latitude},${item.longitude}`);
  }
  return null;
}

function indicatorChips(item: TpkKeluargaItem): string[] {
  const chips: string[] = [];
  for (const key of CHIP_INDIKATOR_KEYS) {
    const on =
      key === "ibuHamil"
        ? item.indikator.ibuHamil
        : key === "baduta"
          ? item.indikator.baduta
          : key === "balita"
            ? item.indikator.balita
            : key === "jambanTidakLayak"
              ? item.indikator.jambanTidakLayak
              : item.indikator.sumberAirTidakLayak;
    if (on) chips.push(sasaranShortLabels[key]);
  }
  if (item.indikator.krs) chips.push("KRS");
  return chips;
}

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function LiveTpkKeluargaPanel({
  tpkId,
  tpkName,
}: {
  tpkId: string;
  tpkName: string;
}) {
  const [page, setPage] = useState(1);
  const [prioritas, setPrioritas] = useState<TpkKeluargaPrioritas[]>([]);
  const [indikator, setIndikator] = useState<TpkKeluargaIndikatorFilter[]>([]);

  const state = useTpkKeluarga(tpkId, {
    page,
    pageSize: PAGE_SIZE,
    prioritas,
    indikator,
  });

  const sourceBadge = useMemo(
    () =>
      state.payload ? resolveSourceBadge(state.payload.meta.source) : null,
    [state.payload],
  );

  const grainCaption = useMemo(() => {
    if (!state.payload) return null;
    const g = state.payload.grain;
    const desa =
      g.namaKelurahan?.trim() ||
      tpkName.replace(/^TPK\s*\(/i, "").replace(/\).*$/, "") ||
      "desa ini";
    const agregat = formatAgregatDesaCaption(g.tpkSeDesa);
    const parts = [
      `Grain kelurahan · ${desa}`,
      agregat,
      g.keluargaSasaranRekap != null
        ? `rekap sasaran ${formatNumber(g.keluargaSasaranRekap)}`
        : null,
      g.krsRekap != null ? `rekap KRS ${formatNumber(g.krsRekap)}` : null,
    ].filter(Boolean);
    return parts.join(" · ");
  }, [state.payload, tpkName]);

  const hasFilters = prioritas.length > 0 || indikator.length > 0;
  const total = state.payload?.total ?? 0;
  const totalPages = Math.max(1, state.payload?.totalPages ?? 1);
  const safePage = Math.min(page, totalPages);
  const start =
    total === 0 ? 0 : (safePage - 1) * (state.payload?.pageSize ?? PAGE_SIZE);
  const end = Math.min(
    start + (state.payload?.pageSize ?? PAGE_SIZE),
    total,
  );

  return (
    <section
      className="design-card overflow-hidden"
      aria-label={`Daftar keluarga sasaran ${tpkName}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <HeartHandshake className="size-4" aria-hidden />
          </span>
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
              Daftar keluarga sasaran
            </div>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-navy">
              Keluarga di desa TPK
            </h2>
            {grainCaption ? (
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                {grainCaption}. Relasi ke TPK lewat kelurahan (bukan TPKID).
              </p>
            ) : (
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                Paging server · filter prioritas & indikator
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sourceBadge ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
                sourceBadge.className,
              )}
            >
              {sourceBadge.label}
            </span>
          ) : null}
          {state.status === "ready" ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
              {formatNumber(total)} keluarga
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-b border-line px-6 py-4">
        <div>
          <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
            Filter prioritas
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRIORITAS_FILTERS.map((item) => {
              const on = prioritas.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  data-on={on}
                  onClick={() => {
                    setPrioritas((prev) => toggleValue(prev, item.key));
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-line transition-colors",
                    "bg-white text-slate-500 hover:bg-slate-50",
                    "data-[on=true]:bg-blue-50 data-[on=true]:text-primary data-[on=true]:ring-blue-200",
                  )}
                  aria-pressed={on}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
            Filter indikator
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INDIKATOR_FILTERS.map((item) => {
              const on = indikator.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  data-on={on}
                  onClick={() => {
                    setIndikator((prev) => toggleValue(prev, item.key));
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-line transition-colors",
                    "bg-white text-slate-500 hover:bg-slate-50",
                    item.chipClass,
                  )}
                  aria-pressed={on}
                >
                  {item.label}
                </button>
              );
            })}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setPrioritas([]);
                  setIndikator([]);
                  setPage(1);
                }}
                className="rounded-full px-2.5 py-1 text-[11px] font-bold text-primary hover:underline"
              >
                Reset filter
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {state.status === "loading" || state.status === "idle" ? (
        <LoadingState label="Memuat daftar keluarga…" rows={5} />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="Gagal memuat daftar keluarga"
          description={
            state.error ?? "Terjadi gangguan saat mengambil data keluarga."
          }
          onRetry={state.refetch}
          className="py-10"
        />
      ) : null}

      {state.status === "empty" ? (
        <EmptyState
          title="TPK tidak ditemukan"
          description={`Tidak ada data keluarga untuk TPKID ${tpkId}.`}
          className="py-10"
        />
      ) : null}

      {state.status === "ready" && state.payload ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line bg-slate-50/80 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                  <th className="px-6 py-3.5 font-extrabold">Keluarga</th>
                  <th className="px-3 py-2.5 font-extrabold">Indikator</th>
                  <th className="px-3 py-2.5 font-extrabold">Prioritas</th>
                  <th className="px-4 py-2.5 text-right font-extrabold">Peta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.payload.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <EmptyState
                        title={
                          hasFilters
                            ? "Tidak ada keluarga yang cocok"
                            : "Belum ada keluarga di desa ini"
                        }
                        description={
                          hasFilters
                            ? "Coba longgarkan filter prioritas atau indikator."
                            : "DWH by_name tidak mengembalikan baris untuk kelurahan TPK ini."
                        }
                        className="py-10"
                      />
                    </td>
                  </tr>
                ) : (
                  state.payload.items.map((item) => {
                    const chips = indicatorChips(item);
                    const maps = mapsHref(item);
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40">
                        <td className="px-6 py-4">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-navy">
                              Kel. {item.namaKepalaKeluarga}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-400 tabular-nums">
                              {item.kodeKeluarga}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-[280px] flex-wrap gap-1">
                            {chips.length === 0 ? (
                              <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                                —
                              </span>
                            ) : (
                              chips.map((label) => (
                                <span
                                  key={label}
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    label === "KRS"
                                      ? "bg-amber-50 text-amber-800"
                                      : "bg-blue-50 text-primary",
                                  )}
                                >
                                  {label}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[12px] font-bold text-navy">
                            {prioritasLabels[item.prioritas]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            {maps ? (
                              <a
                                href={maps}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex size-8 items-center justify-center rounded-xl border border-line bg-white text-primary transition-colors hover:border-blue-300 hover:bg-blue-50"
                                title="Buka di Google Maps"
                                aria-label={`Lokasi Kel. ${item.namaKepalaKeluarga} di Google Maps`}
                              >
                                <MapPin className="size-3.5" aria-hidden />
                              </a>
                            ) : (
                              <span
                                className="inline-flex size-8 items-center justify-center rounded-xl border border-dashed border-line text-slate-300"
                                title="Koordinat belum tersedia"
                                aria-hidden
                              >
                                <MapPin className="size-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
            <p className="text-[11px] text-muted-foreground">
              Menampilkan{" "}
              <span className="font-bold text-navy">
                {total === 0 ? 0 : start + 1}–{end}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-navy">{formatNumber(total)}</span>{" "}
              keluarga
              {hasFilters ? " (terfilter)" : null}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-line"
                disabled={safePage <= 1 || total === 0}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="min-w-[4.5rem] text-center text-[11px] font-bold text-navy tabular-nums">
                {total === 0 ? "0 / 0" : `${safePage} / ${totalPages}`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-line"
                disabled={safePage >= totalPages || total === 0}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
