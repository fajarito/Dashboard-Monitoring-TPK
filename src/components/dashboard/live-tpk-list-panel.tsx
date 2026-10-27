"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, UsersRound } from "lucide-react";

import {
  EmptyState,
  ErrorState,
} from "@/components/dashboard/data-state";
import { GlossaryTerm } from "@/components/dashboard/glossary-term";
import { TpkContactAction } from "@/components/dashboard/tpk-contact-action";
import { TpkIndikatorHover } from "@/components/dashboard/tpk-indikator-hover";
import { TpkScopeSummaryCards } from "@/components/dashboard/tpk-scope-summary-cards";
import { Button } from "@/components/ui/button";
import type {
  PeringkatKabupatenItem,
  PeringkatKecamatanItem,
  PeringkatKelurahanItem,
  TpkListItem,
  TpkListPkb,
  TpkListSort,
} from "@/lib/data/types";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { useTpkList } from "@/lib/hooks/use-tpk-list";
import { formatNumber } from "@/lib/map-data";
import {
  formatAgregatDesaCaption,
  formatAnggotaSubline,
  resolveTpkRowLabels,
  tpkIdSnippet,
} from "@/lib/tpk-display-name";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const SUGGEST_LIMIT = 10;
const SEARCH_MIN_CHARS = 2;

type WilayahOption = { id: string; label: string };

type TpkSuggestion = {
  tpkId: string;
  displayName: string;
  subline: string;
};

/** Level halaman → opsi filter anak + typeahead cari wilayah. */
export type TpkFilterLevel = "kabupaten" | "kecamatan" | "kelurahan" | "none";

type SortKey = TpkListSort | "prioritas-tinggi";

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

function wilayahSubline(
  item: TpkListItem,
  opts?: { showTpkId?: boolean },
): string {
  const base = [
    item.namaKelurahan,
    item.namaKecamatan ? `Kec. ${item.namaKecamatan}` : null,
    item.namaKabupaten,
  ]
    .filter(Boolean)
    .join(" - ");
  if (!opts?.showTpkId) return base;
  const snip = tpkIdSnippet(item.tpkId);
  if (!snip) return base;
  return base ? `${base} · ID ${snip}` : `ID ${snip}`;
}

/** Em dash jujur bila join miss / data belum ada. */
function DashCell({ label }: { label?: string }) {
  return (
    <span
      className="text-sm font-semibold text-slate-300 tabular-nums"
      title={label ?? "Data tidak tersedia"}
    >
      —
    </span>
  );
}

function formatNullableCount(value: number | null | undefined): string | null {
  if (value == null) return null;
  return formatNumber(value);
}

function toApiSort(sortKey: SortKey): TpkListSort {
  if (sortKey === "prioritas-tinggi") return "krs-desc";
  return sortKey;
}

function sortFootnote(sortKey: SortKey): string | null {
  switch (sortKey) {
    case "krs-desc":
      return "diurutkan KRS tertinggi";
    case "krs-asc":
      return "diurutkan KRS terendah";
    case "ibuHamil-desc":
      return "diurutkan Ibu Hamil tertinggi";
    case "baduta-desc":
      return "diurutkan Baduta tertinggi";
    case "balita-desc":
      return "diurutkan Balita tertinggi";
    case "rtlh-desc":
      return "RTLH belum tersedia di DWH";
    case "nama":
      return "diurutkan Nama A–Z";
    case "prioritas-tinggi":
      return "filter prioritas keluarga belum live";
    default:
      return null;
  }
}

export function LiveTpkListPanel({
  provinceSlug,
  provinsiApiId,
  initialKabupatenId = null,
  initialKecamatanId = null,
  initialKelurahanId = null,
  provinceName,
  /** Kartu ringkasan Tim/Anggota/PKB — matikan di halaman yang sudah punya KPI. */
  showSummaryCards = true,
  /**
   * Provinsi → filter kab; kabupaten → filter kec;
   * kecamatan → filter desa/kel; none → tanpa dropdown.
   */
  filterLevel = "kabupaten",
}: {
  provinceSlug: string;
  /** id_provinsi numerik (string). */
  provinsiApiId: string;
  initialKabupatenId?: string | null;
  initialKecamatanId?: string | null;
  initialKelurahanId?: string | null;
  provinceName: string;
  showSummaryCards?: boolean;
  filterLevel?: TpkFilterLevel;
}) {
  const router = useRouter();
  const listboxId = useId();
  const [kabupatenId, setKabupatenId] = useState(initialKabupatenId ?? "");
  const [kecamatanId, setKecamatanId] = useState(initialKecamatanId ?? "");
  const [kelurahanId, setKelurahanId] = useState(initialKelurahanId ?? "");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("krs-desc");
  const [onlyPrioritasTinggi, setOnlyPrioritasTinggi] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);

  useEffect(() => {
    setKabupatenId(initialKabupatenId ?? "");
    setKecamatanId(initialKecamatanId ?? "");
    setKelurahanId(initialKelurahanId ?? "");
    setPage(1);
  }, [initialKabupatenId, initialKecamatanId, initialKelurahanId]);

  // Debounce ~300ms; min 2 karakter untuk filter server + typeahead.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQ(trimmed.length >= SEARCH_MIN_CHARS ? trimmed : "");
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [
    kabupatenId,
    kecamatanId,
    kelurahanId,
    debouncedQ,
    sortKey,
    onlyPrioritasTinggi,
  ]);

  const peringkatKab = usePeringkatKabupaten(
    filterLevel === "kabupaten" ? provinsiApiId : null,
  );
  const peringkatKec = usePeringkatKecamatan(
    filterLevel === "kecamatan" && (initialKabupatenId || kabupatenId)
      ? initialKabupatenId || kabupatenId
      : null,
  );
  const peringkatKel = usePeringkatKelurahan(
    filterLevel === "kelurahan" && (initialKecamatanId || kecamatanId)
      ? initialKecamatanId || kecamatanId
      : null,
  );

  const childOptions: WilayahOption[] = useMemo(() => {
    if (filterLevel === "kabupaten") {
      const items = peringkatKab.payload?.items ?? [];
      const mapped = items.map((item: PeringkatKabupatenItem) => ({
        id: item.id,
        label: item.nama,
      }));
      if (kabupatenId && !mapped.some((opt) => opt.id === kabupatenId)) {
        mapped.unshift({ id: kabupatenId, label: `Kab/kota ${kabupatenId}` });
      }
      return mapped;
    }
    if (filterLevel === "kecamatan") {
      const items = peringkatKec.payload?.items ?? [];
      const mapped = items.map((item: PeringkatKecamatanItem) => ({
        id: item.id,
        label: item.nama,
      }));
      if (kecamatanId && !mapped.some((opt) => opt.id === kecamatanId)) {
        mapped.unshift({
          id: kecamatanId,
          label: `Kecamatan ${kecamatanId}`,
        });
      }
      return mapped;
    }
    if (filterLevel === "kelurahan") {
      const items = peringkatKel.payload?.items ?? [];
      const mapped = items.map((item: PeringkatKelurahanItem) => ({
        id: item.id,
        label: item.nama,
      }));
      if (kelurahanId && !mapped.some((opt) => opt.id === kelurahanId)) {
        mapped.unshift({
          id: kelurahanId,
          label: `Desa/Kel. ${kelurahanId}`,
        });
      }
      return mapped;
    }
    return [];
  }, [
    filterLevel,
    peringkatKab.payload,
    peringkatKec.payload,
    peringkatKel.payload,
    kabupatenId,
    kecamatanId,
    kelurahanId,
  ]);

  const filterLabel =
    filterLevel === "kabupaten"
      ? "Kabupaten/Kota"
      : filterLevel === "kecamatan"
        ? "Kecamatan"
        : filterLevel === "kelurahan"
          ? "Desa/Kelurahan"
          : null;

  const selectedChildId =
    filterLevel === "kabupaten"
      ? kabupatenId
      : filterLevel === "kecamatan"
        ? kecamatanId
        : filterLevel === "kelurahan"
          ? kelurahanId
          : "";

  function setSelectedChildId(id: string) {
    if (filterLevel === "kabupaten") {
      setKabupatenId(id);
      setKecamatanId("");
      setKelurahanId("");
    } else if (filterLevel === "kecamatan") {
      setKecamatanId(id);
      setKelurahanId("");
    } else if (filterLevel === "kelurahan") {
      setKelurahanId(id);
    }
  }

  /** Typeahead wilayah anak: hanya opsi dalam scope halaman (bukan nasional). */
  const wilayahSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < SEARCH_MIN_CHARS) return [];
    return childOptions
      .filter((opt) => opt.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [childOptions, query]);

  const selectedChildLabel = useMemo(() => {
    if (!selectedChildId) return null;
    return (
      childOptions.find((opt) => opt.id === selectedChildId)?.label ??
      selectedChildId
    );
  }, [selectedChildId, childOptions]);

  const scopeLabel = selectedChildLabel ?? provinceName;

  const ringkasanScope = useRingkasanScope(
    kelurahanId
      ? { tingkat: "kelurahan", id: kelurahanId }
      : kecamatanId
        ? { tingkat: "kecamatan", id: kecamatanId }
        : kabupatenId
          ? { tingkat: "kabupaten", id: kabupatenId }
          : { tingkat: "provinsi", id: provinsiApiId },
  );

  const list = useTpkList({
    provinsiId: provinsiApiId,
    kabupatenId: kabupatenId || null,
    kecamatanId: kecamatanId || null,
    kelurahanId: kelurahanId || null,
    q: debouncedQ,
    page,
    pageSize: PAGE_SIZE,
    sort: toApiSort(sortKey),
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

  const isFiltered = Boolean(
    (filterLevel === "kabupaten" && kabupatenId) ||
      (filterLevel === "kecamatan" && kecamatanId) ||
      (filterLevel === "kelurahan" && kelurahanId) ||
      debouncedQ.trim(),
  );
  const total = list.payload?.total ?? 0;
  const totalPages = list.payload?.totalPages ?? 0;
  // Unfiltered: N/N from list. Filtered: N dari list vs M dari ringkasan scope (jujur).
  const scopeTotal = isFiltered
    ? Math.max(ringkasan?.jumlahTPK ?? total, total)
    : total;

  const pageItems = list.payload?.items ?? [];
  const rowLabels = useMemo(
    () => resolveTpkRowLabels(pageItems),
    [pageItems],
  );

  /** Typeahead TPK (8–10): dari hasil list terfilter + ranking relevansi server. */
  const tpkSuggestions: TpkSuggestion[] = useMemo(() => {
    if (debouncedQ.length < SEARCH_MIN_CHARS) return [];
    // Jangan tampilkan saran stale saat debounce belum nyusul.
    if (query.trim() !== debouncedQ) return [];
    if (list.status !== "ready" || !list.payload) return [];
    const labels = resolveTpkRowLabels(list.payload.items);
    return list.payload.items.slice(0, SUGGEST_LIMIT).map((item) => {
      const displayName =
        labels.get(item.tpkId)?.displayName ??
        (item.namaKelurahan
          ? `TPK (${item.namaKelurahan})`
          : `TPK (${item.tpkId})`);
      const anggotaLine = formatAnggotaSubline(item.anggota ?? []);
      const wilayah = [
        item.namaKelurahan,
        item.namaKecamatan ? `Kec. ${item.namaKecamatan}` : null,
        item.pkb?.nama ? `PKB ${item.pkb.nama}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        tpkId: item.tpkId,
        displayName,
        subline: anggotaLine || wilayah || "TPK dalam lingkup halaman",
      };
    });
  }, [debouncedQ, query, list.status, list.payload]);

  const suggestQueryReady = query.trim().length >= SEARCH_MIN_CHARS;
  const searchPending =
    suggestQueryReady && query.trim() !== debouncedQ;
  const showSuggestPanel =
    suggestOpen &&
    suggestQueryReady &&
    (wilayahSuggestions.length > 0 ||
      tpkSuggestions.length > 0 ||
      searchPending ||
      (Boolean(debouncedQ) &&
        (list.status === "loading" || list.status === "idle")) ||
      (list.status === "ready" &&
        Boolean(debouncedQ) &&
        tpkSuggestions.length === 0 &&
        wilayahSuggestions.length === 0));

  useEffect(() => {
    setActiveSuggest(0);
  }, [debouncedQ, wilayahSuggestions.length, tpkSuggestions.length]);

  function openTpkDetail(tpkId: string) {
    setSuggestOpen(false);
    router.push(
      `/wilayah/${provinceSlug}/tpk/${encodeURIComponent(tpkId)}`,
    );
  }

  function applyListFilterNow() {
    const trimmed = query.trim();
    setDebouncedQ(trimmed.length >= SEARCH_MIN_CHARS ? trimmed : "");
    setSuggestOpen(false);
    setPage(1);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setSuggestOpen(false);
      return;
    }

    const flatCount = wilayahSuggestions.length + tpkSuggestions.length;
    if (event.key === "ArrowDown" && suggestQueryReady) {
      event.preventDefault();
      setSuggestOpen(true);
      if (flatCount > 0) {
        setActiveSuggest((i) => (i + 1) % flatCount);
      }
      return;
    }
    if (event.key === "ArrowUp" && flatCount > 0) {
      event.preventDefault();
      setActiveSuggest((i) => (i - 1 + flatCount) % flatCount);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (suggestOpen && flatCount > 0) {
        if (activeSuggest < wilayahSuggestions.length) {
          const opt = wilayahSuggestions[activeSuggest];
          if (opt) {
            setSelectedChildId(opt.id);
            setQuery("");
            setDebouncedQ("");
            setSuggestOpen(false);
          }
          return;
        }
        const tpk =
          tpkSuggestions[activeSuggest - wilayahSuggestions.length];
        if (tpk) {
          openTpkDetail(tpk.tpkId);
          return;
        }
      }
      // Enter tanpa pilihan → terapkan filter daftar.
      applyListFilterNow();
    }
  }

  const maxKrsOnPage =
    pageItems.length > 0
      ? Math.max(...pageItems.map((t) => t.krs ?? -1))
      : -1;

  const start =
    list.payload && list.payload.items.length > 0
      ? (list.payload.page - 1) * list.payload.pageSize + 1
      : 0;
  const end =
    list.payload && list.payload.items.length > 0
      ? start + list.payload.items.length - 1
      : 0;

  const footnote = sortFootnote(sortKey);
  const hasAnyKrs = pageItems.some((item) => item.krs != null);

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
              filter wilayah, urutkan, hover Kel. Sasaran/KRS untuk 6 indikator,
              lalu buka Detail
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
          <div className="relative">
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
                  if (e.target.value.trim().length >= SEARCH_MIN_CHARS) {
                    setSuggestOpen(true);
                  }
                }}
                onFocus={() => {
                  if (query.trim().length >= SEARCH_MIN_CHARS) {
                    setSuggestOpen(true);
                  }
                }}
                onBlur={() => {
                  // Delay agar klik suggestion sempat terproses.
                  window.setTimeout(() => setSuggestOpen(false), 150);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={`Cari desa, register, anggota, atau PKB di ${provinceName}…`}
                className="h-9 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-[12px] text-navy outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2"
                aria-label="Cari TPK dalam lingkup halaman (desa, nomor register, anggota, PKB)"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={showSuggestPanel}
                role="combobox"
                autoComplete="off"
              />
            </label>
            {showSuggestPanel ? (
              <div
                id={listboxId}
                className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-[var(--shadow-soft)]"
                role="listbox"
                aria-label={`Saran TPK di ${provinceName}`}
              >
                {wilayahSuggestions.length > 0 ? (
                  <div className="px-3 pt-2 pb-1 text-[9px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
                    {filterLabel ?? "Wilayah"}
                  </div>
                ) : null}
                {wilayahSuggestions.map((opt, index) => (
                  <button
                    key={`wilayah-${opt.id}`}
                    type="button"
                    role="option"
                    aria-selected={activeSuggest === index}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px]",
                      activeSuggest === index
                        ? "bg-blue-50"
                        : "hover:bg-blue-50",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveSuggest(index)}
                    onClick={() => {
                      setSelectedChildId(opt.id);
                      setQuery("");
                      setDebouncedQ("");
                      setSuggestOpen(false);
                    }}
                  >
                    <span className="font-semibold text-navy">{opt.label}</span>
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      Filter
                    </span>
                  </button>
                ))}

                {tpkSuggestions.length > 0 ? (
                  <div className="px-3 pt-2 pb-1 text-[9px] font-extrabold tracking-[0.14em] text-slate-400 uppercase">
                    TPK
                  </div>
                ) : null}
                {tpkSuggestions.map((opt, index) => {
                  const flatIndex = wilayahSuggestions.length + index;
                  return (
                    <button
                      key={`tpk-${opt.tpkId}`}
                      type="button"
                      role="option"
                      aria-selected={activeSuggest === flatIndex}
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2 text-left",
                        activeSuggest === flatIndex
                          ? "bg-blue-50"
                          : "hover:bg-blue-50",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveSuggest(flatIndex)}
                      onClick={() => openTpkDetail(opt.tpkId)}
                    >
                      <span className="text-[12px] font-semibold text-navy">
                        {opt.displayName}
                      </span>
                      <span className="truncate text-[10px] text-slate-400">
                        {opt.subline}
                      </span>
                    </button>
                  );
                })}

                {searchPending ||
                (Boolean(debouncedQ) &&
                  (list.status === "loading" || list.status === "idle")) ? (
                  <p className="px-3 py-2 text-[11px] text-slate-400">
                    Mencari TPK…
                  </p>
                ) : null}

                {list.status === "ready" &&
                debouncedQ &&
                tpkSuggestions.length === 0 &&
                wilayahSuggestions.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-500">
                    Tidak ada TPK yang cocok dengan &ldquo;{debouncedQ}&rdquo;
                    di lingkup{" "}
                    <span className="font-semibold text-navy">{scopeLabel}</span>
                    . Coba desa, nomor register, nama anggota, atau PKB.
                  </p>
                ) : null}

                {suggestQueryReady ? (
                  <p className="border-t border-line px-3 py-1.5 text-[10px] text-slate-400">
                    Enter = filter daftar · pilih saran = buka Detail
                  </p>
                ) : null}
              </div>
            ) : null}
            {suggestOpen &&
            query.trim().length > 0 &&
            query.trim().length < SEARCH_MIN_CHARS ? (
              <p className="mt-1 text-[11px] text-slate-400">
                Ketik minimal {SEARCH_MIN_CHARS} karakter untuk mencari.
              </p>
            ) : null}
          </div>

          <div
            className={cn(
              "grid gap-2.5",
              filterLabel
                ? "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]"
                : "sm:grid-cols-[minmax(0,1fr)_auto]",
            )}
          >
            {filterLabel ? (
              <label className="block min-w-0">
                <span className="mb-1 block text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                  Filter {filterLabel.toLowerCase()}
                </span>
                <select
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className={selectClass}
                  aria-label={`Filter ${filterLabel}`}
                >
                  <option value="">Semua {filterLabel.toLowerCase()}</option>
                  {childOptions.map((opt) => (
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

          {sortKey === "rtlh-desc" ? (
            <p className="text-[11px] leading-snug text-slate-500">
              Kolom RTLH belum ada di DWH — semua baris menampilkan{" "}
              <span className="font-semibold text-navy">—</span>.
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
              <table className="w-full min-w-[720px] text-left">
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
                    <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {onlyPrioritasTinggi || pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <EmptyState
                          title={
                            onlyPrioritasTinggi
                              ? "Filter Prioritas 1–2 belum tersedia"
                              : debouncedQ
                                ? "Tidak ada TPK yang cocok"
                                : "Tidak ada TPK yang cocok"
                          }
                          description={
                            onlyPrioritasTinggi
                              ? "Data keluarga prioritas per TPK belum live. Matikan filter untuk melihat daftar dari API."
                              : debouncedQ
                                ? `Tidak ditemukan hasil untuk “${debouncedQ}” di ${scopeLabel}. Coba desa, nomor register, nama anggota, atau PKB — atau hapus filter.`
                                : "Ubah kata kunci atau filter wilayah — atau hapus filter untuk melihat seluruh daftar."
                          }
                          action={
                            onlyPrioritasTinggi || isFiltered ? (
                              <button
                                type="button"
                                className="text-[12px] font-bold text-primary hover:underline"
                                onClick={() => {
                                  setOnlyPrioritasTinggi(false);
                                  setQuery("");
                                  if (filterLevel === "kabupaten") {
                                    setKabupatenId("");
                                    setKecamatanId("");
                                    setKelurahanId("");
                                  } else if (filterLevel === "kecamatan") {
                                    setKecamatanId("");
                                    setKelurahanId("");
                                    // Pertahankan kab halaman
                                    setKabupatenId(initialKabupatenId ?? "");
                                  } else if (filterLevel === "kelurahan") {
                                    setKelurahanId("");
                                    setKabupatenId(initialKabupatenId ?? "");
                                    setKecamatanId(initialKecamatanId ?? "");
                                  }
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
                      const label = rowLabels.get(item.tpkId);
                      const displayName =
                        label?.displayName ?? `TPK (${item.tpkId})`;
                      const status = statusLabel(item.status);
                      const anggotaLine = formatAnggotaSubline(
                        item.anggota ?? [],
                      );
                      const subline = wilayahSubline(item, {
                        // ID hanya bila se-desa & belum ada nama anggota pembeda.
                        showTpkId:
                          Boolean(label?.showTpkIdInSubline) && !anggotaLine,
                      });
                      const sasaranText = formatNullableCount(
                        item.keluargaSasaran,
                      );
                      const krsText = formatNullableCount(item.krs);
                      const agregatCaption = formatAgregatDesaCaption(
                        item.tpkSeDesa ?? 1,
                      );
                      const highlightKrs =
                        sortKey === "krs-desc" &&
                        hasAnyKrs &&
                        item.krs != null &&
                        item.krs === maxKrsOnPage &&
                        maxKrsOnPage > 0;

                      return (
                        <tr
                          key={item.tpkId}
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
                                {anggotaLine ? (
                                  <span
                                    className="mt-0.5 block text-[10px] font-medium leading-snug text-slate-400"
                                    title="Anggota TPK (Bidan · PKK · Kader KB)"
                                  >
                                    {anggotaLine}
                                  </span>
                                ) : null}
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {subline || "Wilayah belum terpetakan"}
                                </span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <PkbCell pkb={item.pkb} />
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <TpkIndikatorHover
                              indikator={item.indikator}
                              label={`Indikator desa untuk ${displayName}`}
                            >
                              {sasaranText != null ? (
                                <span
                                  className="inline-flex min-w-[2.75rem] flex-col items-center rounded-lg bg-blue-50/90 px-2 py-1 ring-1 ring-transparent transition-[box-shadow,ring-color] group-hover:ring-blue-100"
                                  title={
                                    agregatCaption
                                      ? `${agregatCaption} — hover untuk 6 indikator`
                                      : "Hover / ketuk untuk 6 indikator desa"
                                  }
                                >
                                  <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                                    {sasaranText}
                                  </span>
                                  {agregatCaption ? (
                                    <span className="mt-0.5 max-w-[5.5rem] text-center text-[8px] font-semibold leading-tight tracking-wide text-slate-400 normal-case">
                                      {agregatCaption}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                <DashCell label="Kel. sasaran tidak tersedia — hover tetap menampilkan indikator bila ada" />
                              )}
                            </TpkIndikatorHover>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <TpkIndikatorHover
                              indikator={item.indikator}
                              label={`Indikator desa untuk ${displayName}`}
                            >
                              {krsText != null ? (
                                <span
                                  className={cn(
                                    "inline-flex min-w-[2.75rem] flex-col items-center rounded-lg px-2 py-1 ring-1 ring-transparent transition-[box-shadow,ring-color]",
                                    highlightKrs
                                      ? "bg-amber-100 ring-amber-200"
                                      : "bg-amber-50/90 group-hover:ring-amber-100",
                                  )}
                                  title={
                                    agregatCaption
                                      ? `${agregatCaption} — hover untuk 6 indikator`
                                      : "Hover / ketuk untuk 6 indikator desa"
                                  }
                                >
                                  <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                                    {krsText}
                                  </span>
                                  <span className="text-[8px] font-bold tracking-wider text-amber-700/80 uppercase">
                                    {highlightKrs ? "Tertinggi" : "Berisiko"}
                                  </span>
                                  {agregatCaption ? (
                                    <span className="mt-0.5 max-w-[5.5rem] text-center text-[8px] font-semibold leading-tight tracking-wide text-slate-400 normal-case">
                                      {agregatCaption}
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                <DashCell label="KRS kelurahan tidak tersedia — hover tetap menampilkan indikator bila ada" />
                              )}
                            </TpkIndikatorHover>
                          </td>
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
                {footnote ? ` · ${footnote}` : null}
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

function PkbCell({ pkb }: { pkb: TpkListPkb | null }) {
  if (!pkb || !pkb.nama) {
    return (
      <div className="min-w-[160px] text-[12px] text-slate-400">
        <span className="font-semibold">—</span>
        <span className="mt-0.5 block text-[10px]">
          PKB desa binaan tidak ditemukan
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-[200px] max-w-[260px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] font-extrabold text-navy">{pkb.nama}</span>
        {pkb.jabatan ? (
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-primary uppercase">
            {pkb.jabatan}
          </span>
        ) : null}
        {pkb.jabatanDetail ? (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            {pkb.jabatanDetail}
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-400 tabular-nums">
          <div>
            {pkb.nip || pkb.pkbId ? `NIP ${pkb.nip || pkb.pkbId}` : "NIP —"}
          </div>
          <div>{pkb.nik ? `NIK ${pkb.nik}` : "NIK —"}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TpkContactAction phone={pkb.noHp} kind="call" size="sm" />
          <TpkContactAction phone={pkb.noHp} kind="whatsapp" size="sm" />
        </div>
      </div>
    </div>
  );
}
