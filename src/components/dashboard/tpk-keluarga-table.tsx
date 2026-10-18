"use client";

import { useMemo, useState } from "react";
import { HeartHandshake, MapPin } from "lucide-react";

import {
  KeluargaFotoAction,
  KeluargaFotoModal,
  type KeluargaFotoKind,
} from "@/components/dashboard/keluarga-foto-preview";
import {
  PhoneStatusHint,
  TpkContactAction,
} from "@/components/dashboard/tpk-contact-action";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranShortLabels,
  type SasaranKey,
} from "@/lib/sasaran-indikator";
import {
  googleMapsSearchUrl,
  prioritasLabels,
  type KeluargaBinaan,
} from "@/lib/tpk-drilldown-data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

const filterChipClass: Record<SasaranKey, string> = {
  ibuHamil: "data-[on=true]:bg-rose-50 data-[on=true]:text-rose-700 data-[on=true]:ring-rose-200",
  baduta: "data-[on=true]:bg-blue-50 data-[on=true]:text-primary data-[on=true]:ring-blue-200",
  balita: "data-[on=true]:bg-cyan-50 data-[on=true]:text-cyan-800 data-[on=true]:ring-cyan-200",
  jambanTidakLayak:
    "data-[on=true]:bg-amber-50 data-[on=true]:text-amber-800 data-[on=true]:ring-amber-200",
  sumberAirTidakLayak:
    "data-[on=true]:bg-sky-50 data-[on=true]:text-sky-800 data-[on=true]:ring-sky-200",
  rtlh: "data-[on=true]:bg-orange-50 data-[on=true]:text-orange-800 data-[on=true]:ring-orange-200",
};

function matchesFilters(item: KeluargaBinaan, filters: SasaranKey[]) {
  if (filters.length === 0) return true;
  return filters.every((key) => item.indikator[key]);
}

export function TpkKeluargaTable({
  keluarga,
  tpkName,
}: {
  keluarga: KeluargaBinaan[];
  tpkName: string;
}) {
  const [filters, setFilters] = useState<SasaranKey[]>([]);
  const [page, setPage] = useState(1);
  const [fotoPreview, setFotoPreview] = useState<{
    kind: KeluargaFotoKind;
    url: string | null;
    keluargaName: string;
  } | null>(null);

  const filtered = useMemo(
    () => keluarga.filter((item) => matchesFilters(item, filters)),
    [keluarga, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  function toggleFilter(key: SasaranKey) {
    setFilters((prev) => {
      const next = prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key];
      return next;
    });
    setPage(1);
  }

  return (
    <section
      className="design-card overflow-hidden"
      aria-label={`Daftar keluarga binaan ${tpkName}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <HeartHandshake className="size-4" aria-hidden />
          </span>
          <div>
            <div className="section-title">Daftar keluarga binaan</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Filter, paging, Maps, telepon, serta preview foto jamban & rumah
            </p>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
          {formatNumber(filtered.length)} / {formatNumber(keluarga.length)}{" "}
          keluarga
        </span>
      </div>

      <div className="border-b border-line px-6 py-4">
        <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
          Filter indikator
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sasaranKeys.map((key) => {
            const on = filters.includes(key);
            return (
              <button
                key={key}
                type="button"
                data-on={on}
                onClick={() => toggleFilter(key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-line transition-colors",
                  "bg-white text-slate-500 hover:bg-slate-50",
                  filterChipClass[key],
                )}
                aria-pressed={on}
              >
                {sasaranShortLabels[key]}
              </button>
            );
          })}
          {filters.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setFilters([]);
                setPage(1);
              }}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-primary hover:underline"
            >
              Reset filter
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50/80 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              <th className="px-6 py-3.5 font-extrabold">Keluarga</th>
              <th className="px-3 py-2.5 font-extrabold">Indikator</th>
              <th className="px-3 py-2.5 font-extrabold">Prioritas</th>
              <th className="px-3 py-2.5 text-center font-extrabold">Foto</th>
              <th className="px-4 py-2.5 text-right font-extrabold">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-muted-foreground"
                >
                  Tidak ada keluarga yang cocok dengan filter terpilih.
                </td>
              </tr>
            ) : (
              pageItems.map((item) => {
                const chips = sasaranKeys.filter((key) => item.indikator[key]);
                return (
                  <tr key={item.id} className="hover:bg-blue-50/40">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-1 ring-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.photoUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 object-cover"
                            loading="lazy"
                          />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-navy">
                            Kel. {item.kepalaKeluarga}
                          </div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                            {item.familyCode}
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {item.alamatRingkas}
                          </p>
                          <PhoneStatusHint
                            phone={item.phone}
                            className="mt-1 block"
                          />
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
                          chips.map((key) => (
                            <span
                              key={key}
                              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-primary"
                            >
                              {sasaranShortLabels[key]}
                            </span>
                          ))
                        )}
                        {item.indikator.krs ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            KRS
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[12px] font-bold text-navy">
                        {prioritasLabels[item.prioritas]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <KeluargaFotoAction
                          kind="jamban"
                          url={item.fotoJambanUrl}
                          keluargaName={item.kepalaKeluarga}
                          onOpen={setFotoPreview}
                        />
                        <KeluargaFotoAction
                          kind="rumah"
                          url={item.fotoRumahDepanUrl}
                          keluargaName={item.kepalaKeluarga}
                          onOpen={setFotoPreview}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={googleMapsSearchUrl(item.mapsQuery)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-xl border border-line bg-white text-primary transition-colors hover:border-blue-300 hover:bg-blue-50"
                          title="Cari di Google Maps"
                          aria-label={`Cari lokasi Kel. ${item.kepalaKeluarga} di Google Maps`}
                        >
                          <MapPin className="size-3.5" aria-hidden />
                        </a>
                        <TpkContactAction
                          phone={item.phone}
                          kind="call"
                          size="sm"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <KeluargaFotoModal
        open={fotoPreview != null}
        kind={fotoPreview?.kind ?? null}
        url={fotoPreview?.url ?? null}
        keluargaName={fotoPreview?.keluargaName ?? ""}
        onClose={() => setFotoPreview(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p className="text-[11px] text-muted-foreground">
          Menampilkan{" "}
          <span className="font-bold text-navy">
            {filtered.length === 0 ? 0 : start + 1}–
            {Math.min(start + PAGE_SIZE, filtered.length)}
          </span>{" "}
          dari{" "}
          <span className="font-bold text-navy">
            {formatNumber(filtered.length)}
          </span>{" "}
          keluarga
          {filters.length > 0 ? " (terfilter)" : null}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-line"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Sebelumnya
          </Button>
          <span className="min-w-[4.5rem] text-center text-[11px] font-bold text-navy tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-line"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </section>
  );
}
