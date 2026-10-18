"use client";

import {
  BriefcaseBusiness,
  HeartHandshake,
  Layers2,
  MapPinned,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  MapSkeleton,
  parseDemoState,
  type DemoUiState,
} from "@/components/dashboard/data-state";
import { KomposisiPrioritasCard } from "@/components/dashboard/komposisi-prioritas-card";
import { KomposisiTpkCard } from "@/components/dashboard/komposisi-tpk-card";
import { ProvinceSebaranTable } from "@/components/dashboard/province-sebaran-table";
import { QuickProvincePicks } from "@/components/dashboard/quick-province-picks";
import { RasioInsightPanels } from "@/components/dashboard/rasio-insight-panels";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { Button } from "@/components/ui/button";
import { useHomeAgregat } from "@/lib/hooks/use-home-agregat";
import {
  formatNumber,
  metricHelp,
  metricLabels,
  metricOptions,
  provinces,
  type MetricKey,
  type Province,
} from "@/lib/map-data";
import { getLegendRanges } from "@/lib/map-style";
import { mapNoDataColor } from "@/lib/navigation";
import {
  getPrioritasKomposisi,
  getSasaranForScope,
  type PrioritasSlice,
  type SasaranCounts,
} from "@/lib/sasaran-indikator";
import {
  getWilayahById,
  wilayahLevelLabels,
  type WilayahSearchItem,
} from "@/lib/wilayah-search-data";

const IndonesiaMap = dynamic(
  () =>
    import("@/components/dashboard/indonesia-map").then(
      (module) => module.IndonesiaMap,
    ),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

const kpiCards: {
  key: MetricKey;
  label: string;
  unit: string;
  noteLive: string;
  noteMock: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    key: "tpk",
    label: "Jumlah TPK",
    unit: "tim",
    noteLive: "Agregat nasional (live)",
    noteMock: "Agregat nasional (simulasi)",
    icon: Users,
    color: "bg-blue-100 text-blue-700",
  },
  {
    key: "anggota",
    label: "Jumlah Anggota TPK",
    unit: "orang",
    noteLive: "Agregat nasional (live)",
    noteMock: "Agregat nasional (simulasi)",
    icon: UsersRound,
    color: "bg-cyan-100 text-cyan-700",
  },
  {
    key: "pkb",
    label: "Jumlah PKB",
    unit: "petugas",
    noteLive: "PKB/PLKB pembina wilayah",
    noteMock: "PKB/PLKB pembina wilayah",
    icon: BriefcaseBusiness,
    color: "bg-indigo-100 text-indigo-700",
  },
  {
    key: "krs",
    label: "Jumlah Keluarga Berisiko Stunting (KRS)",
    unit: "keluarga",
    noteLive: "Keluarga unik, tanpa duplikasi",
    noteMock: "Keluarga unik, tanpa duplikasi",
    icon: HeartHandshake,
    color: "bg-amber-100 text-amber-700",
  },
];

const PRIORITAS_COLORS: Record<string, string> = {
  p1: "#0b4dd8",
  p2: "#155eef",
  p3: "#3b82f6",
  p4: "#93c5fd",
  bukan: "#94a3b8",
};

function slicesFromRingkasanPrioritas(
  prioritas: {
    prioritas1: number;
    prioritas2: number;
    prioritas3: number;
    prioritas4: number;
    bukan: number;
  },
  total: number,
): PrioritasSlice[] {
  const entries: Array<{ id: PrioritasSlice["id"]; label: string; value: number }> =
    [
      { id: "p1", label: "Prioritas 1", value: prioritas.prioritas1 },
      { id: "p2", label: "Prioritas 2", value: prioritas.prioritas2 },
      { id: "p3", label: "Prioritas 3", value: prioritas.prioritas3 },
      { id: "p4", label: "Prioritas 4", value: prioritas.prioritas4 },
      { id: "bukan", label: "Bukan Prioritas", value: prioritas.bukan },
    ];
  return entries.map((entry) => ({
    ...entry,
    share: total > 0 ? entry.value / total : 0,
    color: PRIORITAS_COLORS[entry.id] ?? "#94a3b8",
    percent: total > 0 ? (entry.value / total) * 100 : 0,
  }));
}

export function MapSebaran() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wilayahParam = searchParams.get("wilayah");
  const demoParam = searchParams.get("demo");
  const [metric, setMetric] = useState<MetricKey>("tpk");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Province | null>(null);
  const [focusedWilayah, setFocusedWilayah] = useState<WilayahSearchItem | null>(
    null,
  );
  const homeAgregat = useHomeAgregat();
  const legend = useMemo(() => getLegendRanges(metric), [metric]);

  /** KPI nasional: hanya dari GET /api/ringkasan — tanpa fallback mock. */
  const kpiTotals = useMemo(() => {
    if (!homeAgregat.ringkasan) return null;
    return {
      tpk: homeAgregat.ringkasan.jumlahTPK,
      anggota: homeAgregat.ringkasan.jumlahAnggota,
      pkb: homeAgregat.ringkasan.jumlahPKB,
      krs: homeAgregat.ringkasan.jumlahKRS,
    };
  }, [homeAgregat.ringkasan]);

  const dataSource =
    homeAgregat.ringkasan?.meta.source ??
    homeAgregat.peringkat?.meta.source ??
    null;

  const sasaranScope = useMemo(() => {
    // Drill provinsi tetap dari helper lokal; nasional dari API jika ada.
    if (selected) return getSasaranForScope(selected);
    if (homeAgregat.ringkasan) {
      const ind = homeAgregat.ringkasan.indikator;
      const counts: SasaranCounts = {
        ibuHamil: ind.bumil,
        baduta: ind.baduta,
        balita: ind.balita,
        jambanTidakLayak: ind.jambanTL,
        sumberAirTidakLayak: ind.airTL,
        rtlh: ind.rtlh ?? 0,
      };
      return { scopeLabel: "Nasional", counts };
    }
    return getSasaranForScope(null);
  }, [selected, homeAgregat.ringkasan]);

  const prioritas = useMemo(() => {
    if (selected) return getPrioritasKomposisi(selected);
    if (homeAgregat.ringkasan) {
      const total = homeAgregat.ringkasan.jumlahSasaran;
      return {
        scopeLabel: "Nasional",
        total,
        slices: slicesFromRingkasanPrioritas(
          homeAgregat.ringkasan.komposisiPrioritas,
          total,
        ),
      };
    }
    return getPrioritasKomposisi(null);
  }, [selected, homeAgregat.ringkasan]);

  const retryAgregat = () => {
    homeAgregat.refetch();
    if (demoParam) {
      router.replace("/", { scroll: false });
    }
  };

  /**
   * Status kartu ringkasan vs tabel peringkat dipisah agar empty ranking
   * tidak mengosongkan KPI. Query ?demo= tetap untuk smoke UI.
   */
  const ringkasanState: DemoUiState = useMemo(() => {
    const forced = parseDemoState(demoParam);
    if (demoParam && forced !== "ready") return forced;
    if (homeAgregat.status === "loading") return "loading";
    if (homeAgregat.status === "error") return "error";
    if (!homeAgregat.ringkasan) return "empty";
    return "ready";
  }, [demoParam, homeAgregat.status, homeAgregat.ringkasan]);

  const peringkatState: DemoUiState = useMemo(() => {
    const forced = parseDemoState(demoParam);
    if (demoParam && forced !== "ready") return forced;
    if (homeAgregat.status === "loading") return "loading";
    if (homeAgregat.status === "error") return "error";
    const items = homeAgregat.peringkat?.items;
    if (!items || items.length === 0) return "empty";
    return "ready";
  }, [demoParam, homeAgregat.status, homeAgregat.peringkat]);

  /** Demo peta (?demo=loading|error) — tidak menahan first paint API. */
  const mapDemoState: DemoUiState = useMemo(() => {
    const forced = parseDemoState(demoParam);
    if (demoParam && forced !== "ready") return forced;
    return "ready";
  }, [demoParam]);

  useEffect(() => {
    if (!wilayahParam) {
      setFocusedWilayah(null);
      return;
    }
    const item = getWilayahById(wilayahParam);
    if (!item) {
      setFocusedWilayah(null);
      return;
    }
    const province = provinces.find((entry) => entry.id === item.provinceId);
    if (province) {
      setSelected(province);
      setFocusedWilayah(item);
    }
  }, [wilayahParam]);

  const clearFocus = () => {
    setFocusedWilayah(null);
    setSelected(null);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  const selectProvince = (province: Province) => {
    setFocusedWilayah(null);
    setSelected(province);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  return (
    <section className="animate-content-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Fase 1 · Fondasi visual</div>
          <h1 className="page-title">Peta Sebaran TPK</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gambaran cepat sebaran Tim Pendamping Keluarga di seluruh Indonesia
            — siap dibaca pimpinan tanpa istilah rumit. Gunakan kolom cari di
            atas untuk menemukan wilayah hingga desa.
          </p>
        </div>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-xl border-line bg-white text-ink hover:border-blue-300 hover:bg-blue-50"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
          >
            <Layers2 className="size-4 text-primary" aria-hidden />
            Ganti Data Peta
          </Button>
          {pickerOpen ? (
            <div
              className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-line bg-white p-2 shadow-[var(--shadow-card)]"
              role="listbox"
              aria-label="Pilih data peta"
            >
              {metricOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={metric === option}
                  className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors ${
                    metric === option
                      ? "bg-blue-50 text-primary"
                      : "hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    setMetric(option);
                    setPickerOpen(false);
                  }}
                >
                  <span className="text-sm font-bold">{metricLabels[option]}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {metricHelp[option]}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2.5">
        {ringkasanState === "error" ? (
          <div className="design-card">
            <ErrorState
              title="Gagal memuat ringkasan"
              description={
                homeAgregat.error ??
                "Kartu jumlah TPK, PKB, dan KRS tidak dapat dimuat. Coba lagi."
              }
              onRetry={retryAgregat}
            />
          </div>
        ) : null}
        {ringkasanState === "empty" ? (
          <div className="design-card">
            <EmptyState
              title="Ringkasan masih kosong"
              description="Agregat nasional belum tersedia. Muat ulang atau periksa sumber data."
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-line"
                  onClick={retryAgregat}
                >
                  Muat ulang
                </Button>
              }
            />
          </div>
        ) : null}
        {ringkasanState === "loading" || ringkasanState === "ready" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            const active = metric === card.key;
            const note =
              dataSource === "postgres" ? card.noteLive : card.noteMock;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setMetric(card.key)}
                className={`group rounded-2xl border bg-white px-5 py-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:px-6 ${
                  active
                    ? "border-blue-400 ring-2 ring-blue-100"
                    : "border-line"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-1 text-[11px] leading-snug font-semibold tracking-[0.12em] text-slate-400 uppercase">
                    {card.label}
                  </div>
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${card.color}`}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  {ringkasanState === "loading" || !kpiTotals ? (
                    <span
                      className="mt-1 h-9 w-28 animate-pulse rounded-lg bg-slate-100"
                      aria-hidden
                    />
                  ) : (
                    <span className="text-[2rem] leading-none font-extrabold tracking-tight text-navy tabular-nums sm:text-[2.25rem]">
                      {formatNumber(kpiTotals[card.key])}
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-slate-400">
                    {card.unit}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] font-medium text-slate-400">
                    {ringkasanState === "loading" ? "Memuat…" : note}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider uppercase ${
                      active
                        ? "bg-blue-50 text-primary"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {active ? "Aktif" : "Pilih"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        ) : null}

        {selected || homeAgregat.ringkasan ? (
          <SasaranIndikatorPanel
            scopeLabel={sasaranScope.scopeLabel}
            counts={sasaranScope.counts}
            dataSource={selected ? "mock" : dataSource}
          />
        ) : null}

        {homeAgregat.ringkasan ? (
          <RasioInsightPanels
            values={{
              jumlahTPK: homeAgregat.ringkasan.jumlahTPK,
              jumlahKRS: homeAgregat.ringkasan.jumlahKRS,
              jumlahPKB: homeAgregat.ringkasan.jumlahPKB,
              rasioTPK_KRS: homeAgregat.ringkasan.rasioTPK_KRS,
              rasioPKB_desa: homeAgregat.ringkasan.rasioPKB_desa,
              warningBeban: homeAgregat.ringkasan.warningBeban,
              sourceLabel:
                homeAgregat.ringkasan.meta.source === "mock"
                  ? "simulasi"
                  : "live",
            }}
          />
        ) : null}
      </div>

      <div className="design-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div>
            <div className="section-title">Sebaran Nasional</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Klik provinsi untuk melihat ringkasan singkat
            </div>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-primary">
            {metricLabels[metric]}
          </span>
        </div>

        <div className="relative mt-2">
          {/* Peta pakai GeoJSON lokal; jangan blokir first paint menunggu API. */}
          {mapDemoState === "loading" ? (
            <MapSkeleton />
          ) : (
            <IndonesiaMap
              metric={metric}
              selected={selected}
              onSelect={selectProvince}
              forceError={mapDemoState === "error"}
              onRetryError={retryAgregat}
            />
          )}
        </div>

        <div className="mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-5">
          <div
            className="flex flex-wrap items-center gap-2 text-[9px] font-semibold text-muted-foreground"
            aria-label="Legenda warna peta"
          >
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span
                  className="h-2.5 w-5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span>{item.label}</span>
              </span>
            ))}
            <span className="ml-1 flex items-center gap-1">
              <span
                className="h-2.5 w-5 rounded-sm"
                style={{ backgroundColor: mapNoDataColor }}
                aria-hidden
              />
              Tanpa data
            </span>
          </div>
          <div className="text-[9px] text-slate-400">
            {metricLabels[metric]} • batas BAKOSURTANAL / Dukcapil 2019 • peta
            lokal
            {dataSource === "postgres"
              ? " · KPI live"
              : dataSource === "mock"
                ? " · KPI simulasi"
                : ""}
          </div>
        </div>
      </div>

      {/* Pill cepat: di bawah peta, di atas tabel + kartu */}
      <QuickProvincePicks
        selectedId={selected?.id ?? null}
        onSelect={(id) => {
          const province = provinces.find((entry) => entry.id === id);
          if (province) selectProvince(province);
        }}
      />

      {/* Tabel peringkat | stack kartu komposisi */}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
        <ProvinceSebaranTable
          compact
          selectedId={selected?.id ?? null}
          onSelect={selectProvince}
          ranking={homeAgregat.peringkat?.items ?? null}
          dataSource={dataSource}
          demoState={peringkatState}
          onRetryDemo={retryAgregat}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <KomposisiTpkCard
            variant="compact"
            showDetailLink
            counts={homeAgregat.ringkasan?.komposisiTPK ?? null}
          />
          <KomposisiPrioritasCard
            scopeLabel={prioritas.scopeLabel}
            total={prioritas.total}
            slices={prioritas.slices}
            compact
          />
        </div>
      </div>

      {selected ? (
        <div className="design-card relative overflow-hidden p-6 sm:p-7">
          <button
            type="button"
            className="absolute top-4 right-4 text-slate-400 hover:text-primary"
            aria-label="Tutup ringkasan wilayah"
            onClick={clearFocus}
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-100 text-primary">
              <MapPinned className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold tracking-wider text-primary uppercase">
                {focusedWilayah
                  ? "Hasil pencarian wilayah"
                  : "Ringkasan wilayah"}
              </div>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-navy">
                {focusedWilayah?.name ?? selected.name}
              </h2>
              {focusedWilayah ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-primary uppercase">
                    {wilayahLevelLabels[focusedWilayah.level]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {focusedWilayah.parentContext}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ibu kota: {selected.capital}
                </p>
              )}
            </div>
          </div>
          {focusedWilayah && focusedWilayah.level !== "provinsi" ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Peta menampilkan konteks provinsi{" "}
              <span className="font-bold text-navy">{selected.name}</span>.
              Angka di bawah adalah agregat provinsi (simulasi) — lanjut ke
              daftar berjenjang untuk detail kabupaten/kecamatan.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryStat
              label="Jumlah TPK"
              value={formatNumber(selected.tpk)}
            />
            <SummaryStat
              label="Keluarga berisiko stunting"
              value={formatNumber(selected.krs)}
            />
            <SummaryStat
              label="Anggota TPK"
              value={formatNumber(selected.anggota)}
            />
            <SummaryStat
              label="Koordinator PKB/PLKB"
              value={formatNumber(selected.pkb)}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="h-10 gap-2 rounded-xl bg-primary px-4 text-white shadow-[var(--shadow-button)] hover:bg-[var(--primary-dark)]"
            >
              <Link href={drilldownHrefForSelection(selected.id, focusedWilayah)}>
                {drilldownLabelForSelection(focusedWilayah)}
                <UsersRound className="size-4" aria-hidden />
              </Link>
            </Button>
            <Link
              href={`/wilayah/${selected.id}/tpk`}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Atau langsung daftar TPK
            </Link>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Angka di atas adalah data simulasi untuk demo visual. Telusuri
            berjenjang: provinsi → kabupaten/kota → kecamatan → daftar TPK.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-slate-50/70 px-4 py-4 sm:px-5">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-lg font-extrabold text-navy">{value}</div>
    </div>
  );
}

/** CTA hierarki: provinsi → kab list; kab → kec list; kec/desa → daftar TPK. */
function drilldownHrefForSelection(
  provinceId: string,
  focused: WilayahSearchItem | null,
) {
  if (!focused || focused.level === "provinsi") {
    return `/wilayah/${provinceId}`;
  }
  if (focused.level === "kabupaten_kota") {
    return `/wilayah/${provinceId}/kab/${focused.id}`;
  }
  // Kecamatan Depok / lainnya → halaman kecamatan (daftar TPK)
  if (focused.level === "kecamatan" && focused.id.includes("-depok")) {
    return `/wilayah/${provinceId}/kab/kota-depok/kec/${focused.id}`;
  }
  if (focused.level === "kecamatan") {
    return `/wilayah/${provinceId}/tpk?kec=${encodeURIComponent(focused.id)}`;
  }
  return `/wilayah/${provinceId}`;
}

function drilldownLabelForSelection(focused: WilayahSearchItem | null) {
  if (!focused || focused.level === "provinsi") {
    return "Lihat daftar kabupaten/kota";
  }
  if (focused.level === "kabupaten_kota") {
    return "Lihat daftar kecamatan";
  }
  return "Lihat daftar TPK di kecamatan";
}
