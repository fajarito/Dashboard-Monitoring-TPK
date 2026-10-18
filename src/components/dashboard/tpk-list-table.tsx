"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/dashboard/data-state";
import { GlossaryTerm } from "@/components/dashboard/glossary-term";
import { TpkContactAction } from "@/components/dashboard/tpk-contact-action";
import { TpkScopeSummaryCards } from "@/components/dashboard/tpk-scope-summary-cards";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranShortLabels,
  type SasaranKey,
} from "@/lib/sasaran-indikator";
import {
  summarizeTpkList,
  type TpkPkb,
  type TpkUnit,
} from "@/lib/tpk-drilldown-data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

export type TpkScopeFilterOption = {
  id: string;
  label: string;
};

type SortKey =
  | "krs-desc"
  | "krs-asc"
  | "nama"
  | "prioritas-tinggi"
  | "ibuHamil-desc"
  | "baduta-desc"
  | "balita-desc"
  | "rtlh-desc";

const SASARAN_SORT_KEYS: Partial<Record<SortKey, SasaranKey>> = {
  "ibuHamil-desc": "ibuHamil",
  "baduta-desc": "baduta",
  "balita-desc": "balita",
  "rtlh-desc": "rtlh",
};

function countPrioritasTinggi(tpk: TpkUnit) {
  return tpk.keluarga.filter(
    (item) => item.prioritas === "p1" || item.prioritas === "p2",
  ).length;
}

const selectClass =
  "h-9 w-full rounded-xl border border-line bg-white px-3 text-[12px] font-semibold text-navy outline-none ring-primary/30 focus:ring-2";

export function TpkListTable({
  list,
  provinceId,
  scopeName,
  /** Opsi dropdown wilayah anak (kab di level provinsi, kec di level kab). */
  scopeFilters = [],
  scopeFilterMode = "kabupaten",
}: {
  list: TpkUnit[];
  provinceId: string;
  scopeName: string;
  scopeFilters?: TpkScopeFilterOption[];
  scopeFilterMode?: "kabupaten" | "kecamatan";
}) {
  const [query, setQuery] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("krs-desc");
  const [onlyPrioritasTinggi, setOnlyPrioritasTinggi] = useState(false);
  const [page, setPage] = useState(1);

  const scopeLabel =
    scopeFilterMode === "kabupaten" ? "Kabupaten/Kota" : "Kecamatan";

  const processed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = list.filter((tpk) => {
      if (scopeId) {
        const match =
          scopeFilterMode === "kabupaten"
            ? tpk.kabupatenId === scopeId
            : tpk.kecamatanId === scopeId;
        if (!match) return false;
      }
      if (onlyPrioritasTinggi && countPrioritasTinggi(tpk) === 0) {
        return false;
      }
      if (!q) return true;
      const hay =
        `${tpk.name} ${tpk.desa} ${tpk.kecamatan} ${tpk.kabupaten} ${tpk.pkb.name}`.toLowerCase();
      return hay.includes(q);
    });

    const sorted = filtered.slice().sort((a, b) => {
      if (sortKey === "krs-desc") return b.krs - a.krs;
      if (sortKey === "krs-asc") return a.krs - b.krs;
      if (sortKey === "prioritas-tinggi") {
        const diff = countPrioritasTinggi(b) - countPrioritasTinggi(a);
        return diff !== 0 ? diff : b.krs - a.krs;
      }
      const sasaranKey = SASARAN_SORT_KEYS[sortKey];
      if (sasaranKey) {
        const diff = b.sasaran[sasaranKey] - a.sasaran[sasaranKey];
        return diff !== 0 ? diff : b.krs - a.krs;
      }
      return a.name.localeCompare(b.name, "id");
    });

    return sorted;
  }, [list, query, scopeId, scopeFilterMode, sortKey, onlyPrioritasTinggi]);

  const scopeSummary = useMemo(
    () => summarizeTpkList(processed),
    [processed],
  );

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = processed.slice(start, start + PAGE_SIZE);
  const maxKrsOnPage =
    pageItems.length > 0 ? Math.max(...pageItems.map((t) => t.krs)) : 0;

  function resetPage() {
    setPage(1);
  }

  const isFiltered = Boolean(query || scopeId || onlyPrioritasTinggi);
  const summaryScopeLabel = isFiltered
    ? `${scopeName} (hasil filter)`
    : scopeName;

  return (
    <div className="space-y-4">
      <TpkScopeSummaryCards
        tim={scopeSummary.tim}
        anggota={scopeSummary.anggota}
        pkb={scopeSummary.pkb}
        scopeLabel={summaryScopeLabel}
      />

    <section
      className="design-card overflow-hidden"
      aria-label={`Tabel TPK di ${scopeName}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            Daftar TPK
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Tim di{" "}
            <span className="font-semibold text-navy">{scopeName}</span> —
            filter wilayah, urutkan indikator, lalu buka Detail
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
          <UsersRound className="size-3.5" aria-hidden />
          {formatNumber(processed.length)} / {formatNumber(list.length)} TPK
        </span>
      </div>

      <div className="space-y-2.5 border-b border-line px-6 py-4">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Cari nama TPK, desa, kecamatan, atau PKB…"
            className="h-9 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-[12px] text-navy outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2"
            aria-label="Cari daftar TPK"
          />
        </label>

        <div
          className={cn(
            "grid gap-2.5",
            scopeFilters.length > 0
              ? "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
              : "sm:grid-cols-[minmax(0,1fr)_auto]",
          )}
        >
          {scopeFilters.length > 0 ? (
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Filter {scopeLabel.toLowerCase()}
              </span>
              <select
                value={scopeId}
                onChange={(e) => {
                  setScopeId(e.target.value);
                  resetPage();
                }}
                className={selectClass}
                aria-label={`Filter ${scopeLabel}`}
              >
                <option value="">Semua {scopeLabel.toLowerCase()}</option>
                {scopeFilters.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block min-w-0">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
              Urutkan
            </span>
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                resetPage();
              }}
              className={selectClass}
              aria-label="Urutkan daftar TPK"
            >
              <option value="krs-desc">KRS tertinggi</option>
              <option value="krs-asc">KRS terendah</option>
              <option value="ibuHamil-desc">Ibu Hamil tertinggi</option>
              <option value="baduta-desc">Baduta tertinggi</option>
              <option value="balita-desc">Balita tertinggi</option>
              <option value="rtlh-desc">RTLH tertinggi</option>
              <option value="prioritas-tinggi">Prioritas tinggi terbanyak</option>
              <option value="nama">Nama A–Z</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setOnlyPrioritasTinggi((v) => !v);
                resetPage();
              }}
              className={cn(
                "h-9 rounded-xl px-3 text-[11px] font-bold ring-1 transition-colors",
                onlyPrioritasTinggi
                  ? "bg-amber-50 text-amber-800 ring-amber-200"
                  : "bg-white text-slate-500 ring-line hover:bg-slate-50",
              )}
              aria-pressed={onlyPrioritasTinggi}
              title="Tampilkan hanya TPK yang punya keluarga Prioritas 1–2"
            >
              Prioritas 1–2
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[1180px] text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50/90 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              <th className="sticky left-0 z-10 bg-slate-50/95 px-6 py-3.5 font-extrabold backdrop-blur-sm">
                Nama TPK
              </th>
              <th className="min-w-[220px] px-3 py-3 font-extrabold text-slate-500">
                <GlossaryTerm termId="pkb" className="font-extrabold text-slate-500">
                  PKB / PLKB
                </GlossaryTerm>
              </th>
              <th className="px-3 py-3 text-center font-extrabold text-slate-500">
                <GlossaryTerm
                  termId="keluarga-sasaran"
                  className="font-extrabold text-slate-500"
                >
                  Kel. Sasaran
                </GlossaryTerm>
              </th>
              <th className="px-3 py-3 text-center font-extrabold text-slate-500">
                <GlossaryTerm termId="krs" className="font-extrabold text-slate-500">
                  KRS
                </GlossaryTerm>
              </th>
              {sasaranKeys.map((key) => {
                const activeSort = SASARAN_SORT_KEYS[sortKey] === key;
                return (
                <th
                  key={key}
                  className={cn(
                    "px-2.5 py-3 text-center font-extrabold",
                    activeSort && "bg-blue-50/80 text-primary",
                  )}
                >
                  <GlossaryTerm
                    termId={
                      key === "ibuHamil"
                        ? "ibu-hamil"
                        : key === "jambanTidakLayak"
                          ? "jamban-tl"
                          : key === "sumberAirTidakLayak"
                            ? "air-tl"
                            : key === "rtlh"
                              ? "rtlh"
                              : key
                    }
                    className={cn(
                      "font-extrabold",
                      activeSort ? "text-primary" : "text-slate-400",
                    )}
                  >
                    {sasaranShortLabels[key]}
                  </GlossaryTerm>
                </th>
                );
              })}
              <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={5 + sasaranKeys.length} className="p-0">
                  <EmptyState
                    title="Tidak ada TPK yang cocok"
                    description="Ubah kata kunci, wilayah, atau filter prioritas — atau hapus filter untuk melihat seluruh daftar."
                    action={
                      isFiltered ? (
                        <button
                          type="button"
                          className="text-[12px] font-bold text-primary hover:underline"
                          onClick={() => {
                            setQuery("");
                            setScopeId("");
                            setOnlyPrioritasTinggi(false);
                            resetPage();
                          }}
                        >
                          Hapus semua filter
                        </button>
                      ) : null
                    }
                  />
                </td>
              </tr>
            ) : (
              pageItems.map((tpk) => {
                const href = `/wilayah/${provinceId}/tpk/${tpk.id}`;
                const highlightKrs =
                  sortKey === "krs-desc" &&
                  tpk.krs === maxKrsOnPage &&
                  maxKrsOnPage > 0;
                const pTinggi = countPrioritasTinggi(tpk);
                return (
                  <tr
                    key={tpk.id}
                    className={cn(
                      "group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/55",
                      highlightKrs && "bg-amber-50/40",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 px-6 py-4 group-hover:bg-blue-50/55",
                        highlightKrs ? "bg-amber-50/40" : "bg-white",
                      )}
                    >
                      <Link href={href} className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[11px] font-extrabold text-primary ring-1 ring-blue-100">
                          {tpk.code.slice(-3)}
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-extrabold text-navy group-hover:text-primary">
                              {tpk.name}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                                tpk.status === "Aktif"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700",
                              )}
                            >
                              {tpk.status}
                            </span>
                            {pTinggi > 0 ? (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-orange-700 uppercase">
                                P1–2 · {pTinggi}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {tpk.desa} · Kec. {tpk.kecamatan} · {tpk.kabupaten}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 align-top">
                      <PkbCell pkb={tpk.pkb} />
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex min-w-[2.75rem] flex-col items-center rounded-lg bg-blue-50/90 px-2 py-1">
                        <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                          {formatNumber(tpk.keluargaSasaran)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-[2.75rem] flex-col items-center rounded-lg px-2 py-1",
                          highlightKrs
                            ? "bg-amber-100 ring-1 ring-amber-200"
                            : "bg-amber-50/90",
                        )}
                      >
                        <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                          {formatNumber(tpk.krs)}
                        </span>
                        <span className="text-[8px] font-bold tracking-wider text-amber-700/80 uppercase">
                          {highlightKrs ? "Tertinggi" : "Berisiko"}
                        </span>
                      </span>
                    </td>
                    {sasaranKeys.map((key) => {
                      const activeSort = SASARAN_SORT_KEYS[sortKey] === key;
                      return (
                      <td
                        key={key}
                        className={cn(
                          "px-2.5 py-3.5 text-center text-sm font-extrabold tabular-nums text-navy",
                          activeSort && "bg-blue-50/50",
                        )}
                      >
                        {formatNumber(tpk.sasaran[key])}
                      </td>
                      );
                    })}
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-blue-50"
                        aria-label={`Buka detail ${tpk.name}`}
                      >
                        Detail
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
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
            {processed.length === 0 ? 0 : start + 1}–
            {Math.min(start + PAGE_SIZE, processed.length)}
          </span>{" "}
          dari{" "}
          <span className="font-bold text-navy">
            {formatNumber(processed.length)}
          </span>{" "}
          TPK
          {isFiltered ? " (terfilter)" : null}
          {sortKey === "krs-desc"
            ? " · diurutkan KRS tertinggi"
            : sortKey === "ibuHamil-desc"
              ? " · diurutkan Ibu Hamil tertinggi"
              : sortKey === "baduta-desc"
                ? " · diurutkan Baduta tertinggi"
                : sortKey === "balita-desc"
                  ? " · diurutkan Balita tertinggi"
                  : sortKey === "rtlh-desc"
                    ? " · diurutkan RTLH tertinggi"
                    : null}
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
    </div>
  );
}

function PkbCell({ pkb }: { pkb: TpkPkb }) {
  return (
    <div className="min-w-[200px] max-w-[260px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-extrabold text-navy">{pkb.name}</span>
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-primary uppercase">
          {pkb.jabatan}
        </span>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
          {pkb.jabatanDetail}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 font-mono text-[11px] font-semibold tracking-wide text-slate-400 tabular-nums">
          NIK {pkb.nik}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TpkContactAction phone={pkb.phone} kind="call" size="sm" />
          <TpkContactAction phone={pkb.phone} kind="whatsapp" size="sm" />
        </div>
      </div>
    </div>
  );
}
