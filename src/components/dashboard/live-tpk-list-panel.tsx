"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, UsersRound } from "lucide-react";

import {
  EmptyState,
  ErrorState,
} from "@/components/dashboard/data-state";
import { GlossaryTerm } from "@/components/dashboard/glossary-term";
import { TpkScopeSummaryCards } from "@/components/dashboard/tpk-scope-summary-cards";
import { Button } from "@/components/ui/button";
import type { PeringkatKabupatenItem, TpkListItem } from "@/lib/data/types";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { useTpkList } from "@/lib/hooks/use-tpk-list";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranShortLabels,
} from "@/lib/sasaran-indikator";
import { formatTpkDisplayName } from "@/lib/tpk-display-name";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type KabOption = { id: string; label: string };

type SortKey =
  | "krs-desc"
  | "krs-asc"
  | "nama"
  | "prioritas-tinggi"
  | "ibuHamil-desc"
  | "baduta-desc"
  | "balita-desc"
  | "rtlh-desc";

const selectClass =
  "h-9 w-full rounded-xl border border-line bg-white px-3 text-[12px] font-semibold text-navy outline-none ring-primary/30 focus:ring-2";

function registerBadge(item: TpkListItem): string {
  const reg = item.nomorRegister?.trim();
  if (reg) return reg.slice(-3).padStart(3, "0").slice(-3);
  const id = item.tpkId.replace(/\D/g, "");
  if (id.length >= 3) return id.slice(-3);
  return item.tpkId.slice(-3).toUpperCase() || "—";
}

function statusLabel(status: number | null): {
  text: string;
  aktif: boolean;
} | null {
  if (status === 1) return { text: "Aktif", aktif: true };
  if (status === 0) return { text: "Perlu dampingan", aktif: false };
  return null;
}

function wilayahSubline(item: TpkListItem): string {
  return [
    item.namaKelurahan,
    item.namaKecamatan ? `Kec. ${item.namaKecamatan}` : null,
    item.namaKabupaten,
  ]
    .filter(Boolean)
    .join(" - ");
}

/** Em dash jujur bila indikator kelurahan belum terhubung. */
function DashCell({ label }: { label?: string }) {
  return (
    <span
      className="text-sm font-semibold text-slate-300 tabular-nums"
      title={label ?? "Belum tersedia dari agregat live"}
    >
      —
    </span>
  );
}

export function LiveTpkListPanel({
  provinceSlug,
  provinsiApiId,
  initialKabupatenId = null,
  provinceName,
  /** Kartu ringkasan Tim/Anggota/PKB — matikan di halaman yang sudah punya KPI. */
  showSummaryCards = true,
}: {
  provinceSlug: string;
  /** id_provinsi numerik (string). */
  provinsiApiId: string;
  initialKabupatenId?: string | null;
  provinceName: string;
  showSummaryCards?: boolean;
}) {
  const [kabupatenId, setKabupatenId] = useState(initialKabupatenId ?? "");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("krs-desc");
  const [onlyPrioritasTinggi, setOnlyPrioritasTinggi] = useState(false);

  useEffect(() => {
    setKabupatenId(initialKabupatenId ?? "");
    setPage(1);
  }, [initialKabupatenId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [kabupatenId, debouncedQ, sortKey, onlyPrioritasTinggi]);

  const peringkatKab = usePeringkatKabupaten(provinsiApiId);
  const kabOptions: KabOption[] = useMemo(() => {
    const items = peringkatKab.payload?.items ?? [];
    const mapped = items.map((item: PeringkatKabupatenItem) => ({
      id: item.id,
      label: item.nama,
    }));
    if (kabupatenId && !mapped.some((opt) => opt.id === kabupatenId)) {
      mapped.unshift({ id: kabupatenId, label: `Kab/kota ${kabupatenId}` });
    }
    return mapped;
  }, [peringkatKab.payload, kabupatenId]);

  const selectedKabLabel = useMemo(() => {
    if (!kabupatenId) return null;
    return (
      kabOptions.find((opt) => opt.id === kabupatenId)?.label ??
      `Kab/kota ${kabupatenId}`
    );
  }, [kabupatenId, kabOptions]);

  const scopeLabel = selectedKabLabel ?? provinceName;

  const ringkasanScope = useRingkasanScope(
    kabupatenId
      ? { tingkat: "kabupaten", id: kabupatenId }
      : { tingkat: "provinsi", id: provinsiApiId },
  );

  const list = useTpkList({
    provinsiId: provinsiApiId,
    kabupatenId: kabupatenId || null,
    q: debouncedQ,
    page,
    pageSize: PAGE_SIZE,
  });

  const source =
    list.payload?.meta.source ?? ringkasanScope.ringkasan?.meta.source ?? null;
  const badge =
    source === "postgres"
      ? { label: "Data live", className: "bg-emerald-50 text-emerald-700" }
      : source === "mock"
        ? { label: "Data simulasi", className: "bg-amber-50 text-amber-700" }
        : null;

  const cardsLoading =
    ringkasanScope.status === "loading" || ringkasanScope.status === "idle";
  const ringkasan = ringkasanScope.ringkasan;
  const pkbHint =
    source === "postgres"
      ? "PKB/PLKB aktif di wilayah"
      : source === "mock"
        ? "PKB/PLKB unik (simulasi)"
        : "PKB/PLKB di wilayah";

  const isFiltered = Boolean(kabupatenId || debouncedQ.trim());
  const total = list.payload?.total ?? 0;
  const totalPages = list.payload?.totalPages ?? 0;
  // Unfiltered: N/N from list. Filtered: N dari list vs M dari ringkasan scope (jujur).
  const scopeTotal = isFiltered
    ? Math.max(ringkasan?.jumlahTPK ?? total, total)
    : total;

  const pageItems = useMemo(() => {
    const items = list.payload?.items ?? [];
    if (sortKey === "nama") {
      return items
        .slice()
        .sort((a, b) =>
          formatTpkDisplayName(a).localeCompare(formatTpkDisplayName(b), "id"),
        );
    }
    // Indikator/prioritas belum live — urutan server (biasanya register) dipertahankan.
    return items;
  }, [list.payload?.items, sortKey]);

  const start =
    list.payload && list.payload.items.length > 0
      ? (list.payload.page - 1) * list.payload.pageSize + 1
      : 0;
  const end =
    list.payload && list.payload.items.length > 0
      ? start + list.payload.items.length - 1
      : 0;

  const indicatorsLive = false;

  return (
    <div className="space-y-4">
      {showSummaryCards ? (
        <>
          <TpkScopeSummaryCards
            tim={ringkasan?.jumlahTPK ?? null}
            anggota={ringkasan?.jumlahAnggota ?? null}
            pkb={ringkasan?.jumlahPKB ?? null}
            scopeLabel={scopeLabel}
            loading={cardsLoading}
            pkbHint={pkbHint}
            dataSource={source}
          />
          {ringkasanScope.status === "error" ? (
            <ErrorState
              title="Gagal memuat ringkasan wilayah"
              description={
                ringkasanScope.error ??
                "Kartu jumlah Tim/Anggota/PKB tidak dapat dimuat."
              }
              onRetry={ringkasanScope.refetch}
            />
          ) : null}
        </>
      ) : null}

      <section
        className="design-card overflow-hidden"
        aria-label={`Tabel TPK di ${scopeLabel}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
              Daftar TPK
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Tim di{" "}
              <span className="font-semibold text-navy">{scopeLabel}</span> —
              filter wilayah, urutkan indikator, lalu buka Detail
              {badge ? (
                <span
                  className={cn(
                    "ml-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              ) : null}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
            <UsersRound className="size-3.5" aria-hidden />
            {list.status === "ready"
              ? `${formatNumber(total)} / ${formatNumber(scopeTotal)} TPK`
              : "… TPK"}
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama TPK, desa, kecamatan, atau PKB…"
              className="h-9 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-[12px] text-navy outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2"
              aria-label="Cari daftar TPK"
            />
          </label>

          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]">
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Filter kabupaten/kota
              </span>
              <select
                value={kabupatenId}
                onChange={(e) => setKabupatenId(e.target.value)}
                className={selectClass}
                aria-label="Filter kabupaten/kota"
              >
                <option value="">Semua kabupaten/kota</option>
                {kabOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Urutkan
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={selectClass}
                aria-label="Urutkan daftar TPK"
              >
                <option value="krs-desc">KRS tertinggi</option>
                <option value="krs-asc">KRS terendah</option>
                <option value="ibuHamil-desc">Ibu Hamil tertinggi</option>
                <option value="baduta-desc">Baduta tertinggi</option>
                <option value="balita-desc">Balita tertinggi</option>
                <option value="rtlh-desc">RTLH tertinggi</option>
                <option value="prioritas-tinggi">
                  Prioritas tinggi terbanyak
                </option>
                <option value="nama">Nama A–Z</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setOnlyPrioritasTinggi((v) => !v)}
                className={cn(
                  "h-9 rounded-xl px-3 text-[11px] font-bold ring-1 transition-colors",
                  onlyPrioritasTinggi
                    ? "bg-amber-50 text-amber-800 ring-amber-200"
                    : "bg-white text-slate-500 ring-line hover:bg-slate-50",
                )}
                aria-pressed={onlyPrioritasTinggi}
                title="Filter prioritas membutuhkan data keluarga per TPK (belum live)"
              >
                Prioritas 1–2
              </button>
            </div>
          </div>

          {!indicatorsLive ? (
            <p className="text-[11px] leading-snug text-slate-500">
              Indikator KRS &amp; sasaran per TPK belum dihubungkan ke rollup
              kelurahan — kolom menampilkan{" "}
              <span className="font-semibold text-navy">—</span> (bukan angka
              simulasi). Urut indikator &amp; Prioritas 1–2 aktif setelah rollup
              tersedia; sementara hanya{" "}
              <span className="font-semibold text-navy">Nama A–Z</span> yang
              mengurutkan halaman ini.
            </p>
          ) : null}
        </div>

        {list.status === "error" ? (
          <div className="px-6 py-6">
            <ErrorState
              title="Gagal memuat daftar TPK"
              description={list.error ?? "Periksa koneksi atau coba lagi."}
              onRetry={list.refetch}
            />
          </div>
        ) : null}

        {list.status === "loading" || list.status === "idle" ? (
          <div className="space-y-2 px-6 py-5" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : null}

        {list.status === "ready" && list.payload ? (
          <>
            <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[1180px] text-left">
                <thead>
                  <tr className="border-b border-line bg-slate-50/90 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                    <th className="sticky left-0 z-10 bg-slate-50/95 px-6 py-3.5 font-extrabold backdrop-blur-sm">
                      Nama TPK
                    </th>
                    <th className="min-w-[200px] px-3 py-3 font-extrabold text-slate-500">
                      <GlossaryTerm
                        termId="pkb"
                        className="font-extrabold text-slate-500"
                      >
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
                      <GlossaryTerm
                        termId="krs"
                        className="font-extrabold text-slate-500"
                      >
                        KRS
                      </GlossaryTerm>
                    </th>
                    {sasaranKeys.map((key) => (
                      <th
                        key={key}
                        className="px-2.5 py-3 text-center font-extrabold text-slate-400"
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
                          className="font-extrabold text-slate-400"
                        >
                          {sasaranShortLabels[key]}
                        </GlossaryTerm>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {onlyPrioritasTinggi || pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + sasaranKeys.length}
                        className="p-0"
                      >
                        <EmptyState
                          title={
                            onlyPrioritasTinggi
                              ? "Filter Prioritas 1–2 belum tersedia"
                              : "Tidak ada TPK yang cocok"
                          }
                          description={
                            onlyPrioritasTinggi
                              ? "Data keluarga prioritas per TPK belum live. Matikan filter untuk melihat daftar dari API."
                              : "Ubah kata kunci atau kabupaten/kota — atau hapus filter untuk melihat seluruh daftar."
                          }
                          action={
                            onlyPrioritasTinggi || isFiltered ? (
                              <button
                                type="button"
                                className="text-[12px] font-bold text-primary hover:underline"
                                onClick={() => {
                                  setOnlyPrioritasTinggi(false);
                                  setKabupatenId("");
                                  setQuery("");
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
                    pageItems.map((item) => {
                      const href = `/wilayah/${provinceSlug}/tpk/${encodeURIComponent(item.tpkId)}`;
                      const displayName = formatTpkDisplayName(item);
                      const status = statusLabel(item.status);
                      const subline = wilayahSubline(item);

                      return (
                        <tr
                          key={item.tpkId}
                          className="group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/55"
                        >
                          <td className="sticky left-0 z-10 bg-white px-6 py-4 group-hover:bg-blue-50/55">
                            <Link
                              href={href}
                              className="flex items-start gap-3"
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-[11px] font-extrabold text-primary ring-1 ring-blue-100">
                                {registerBadge(item)}
                              </span>
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-extrabold text-navy group-hover:text-primary">
                                    {displayName}
                                  </span>
                                  {status ? (
                                    <span
                                      className={cn(
                                        "rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                                        status.aktif
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-amber-50 text-amber-700",
                                      )}
                                    >
                                      {status.text}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {subline || "Wilayah belum terpetakan"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <div className="min-w-[160px] text-[12px] text-slate-400">
                              <span className="font-semibold">—</span>
                              <span className="mt-0.5 block text-[10px]">
                                PKB per TPK belum live
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <DashCell label="Kel. sasaran belum live" />
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <DashCell label="KRS kelurahan belum live" />
                          </td>
                          {sasaranKeys.map((key) => (
                            <td
                              key={key}
                              className="px-2.5 py-3.5 text-center"
                            >
                              <DashCell />
                            </td>
                          ))}
                          <td className="px-4 py-3.5 text-right">
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-blue-50"
                              aria-label={`Buka detail ${displayName}`}
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
                  {pageItems.length === 0 || onlyPrioritasTinggi
                    ? 0
                    : `${start}–${end}`}
                </span>{" "}
                dari{" "}
                <span className="font-bold text-navy">
                  {formatNumber(total)}
                </span>{" "}
                TPK
                {isFiltered ? " (terfilter)" : null}
                {" · "}
                paging server
                {sortKey === "nama" ? " · diurutkan Nama A–Z" : null}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl border-line"
                  disabled={page <= 1 || onlyPrioritasTinggi}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <span className="min-w-[4.5rem] text-center text-[11px] font-bold text-navy tabular-nums">
                  {Math.max(page, 1)} / {Math.max(totalPages, 1)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl border-line"
                  disabled={
                    onlyPrioritasTinggi ||
                    totalPages === 0 ||
                    page >= totalPages
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
