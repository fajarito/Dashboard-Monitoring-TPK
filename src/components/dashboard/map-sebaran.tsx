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

import { ClientOnly } from "@/components/dashboard/client-only";
import {
  EmptyState,
  ErrorState,
  MapSkeleton,
  parseDemoState,
  type DemoUiState,
} from "@/components/dashboard/data-state";
import { KabupatenSebaranTable } from "@/components/dashboard/kabupaten-sebaran-table";
import { KomposisiPrioritasCard } from "@/components/dashboard/komposisi-prioritas-card";
import { KomposisiTpkCard } from "@/components/dashboard/komposisi-tpk-card";
import { ProvinceSebaranTable } from "@/components/dashboard/province-sebaran-table";
import { QuickProvincePicks } from "@/components/dashboard/quick-province-picks";
import { RasioInsightPanels } from "@/components/dashboard/rasio-insight-panels";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { Button } from "@/components/ui/button";
import type { PeringkatKabupatenItem } from "@/lib/data/types";
import { useHomeAgregat } from "@/lib/hooks/use-home-agregat";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
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
  getProvinsiApiId,
  resolveProvinceFromPeringkatId,
} from "@/lib/province-api-id";
import {
  getPrioritasKomposisi,
  type PrioritasSlice,
  type SasaranCounts,
} from "@/lib/sasaran-indikator";
import {
  getWilayahById,
  wilayahLevelLabels,
  type WilayahSearchItem,
} from "@/lib/wilayah-search-data";

import type { WilayahLevelKey } from "@/components/dashboard/master-wilayah-map";

const MasterWilayahMap = dynamic(
  () =>
    import("@/components/dashboard/master-wilayah-map").then(
      (module) => module.MasterWilayahMap,
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
    noteLive: "Agregat wilayah (live)",
    noteMock: "Agregat wilayah (simulasi)",
    icon: Users,
    color: "bg-blue-100 text-blue-700",
  },
  {
    key: "anggota",
    label: "Jumlah Anggota TPK",
    unit: "orang",
    noteLive: "Agregat wilayah (live)",
    noteMock: "Agregat wilayah (simulasi)",
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
  tidakRisiko: "#86efac",
};

function slicesFromRingkasanPrioritas(
  prioritas: {
    prioritas1: number;
    prioritas2: number;
    prioritas3: number;
    prioritas4: number;
    bukan: number;
    tidakRisiko: number;
  },
  total: number,
): PrioritasSlice[] {
  const entries: Array<{ id: PrioritasSlice["id"]; label: string; value: number }> =
    [
      { id: "p1", label: "Prioritas 1", value: prioritas.prioritas1 },
      { id: "p2", label: "Prioritas 2", value: prioritas.prioritas2 },
      { id: "p3", label: "Prioritas 3", value: prioritas.prioritas3 },
      { id: "p4", label: "Prioritas 4", value: prioritas.prioritas4 },
      { id: "bukan", label: "Bukan prioritas", value: prioritas.bukan },
      {
        id: "tidakRisiko",
        label: "Tidak berisiko",
        value: prioritas.tidakRisiko,
      },
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
  const [selectedKab, setSelectedKab] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [selectedKec, setSelectedKec] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [selectedDesa, setSelectedDesa] = useState<{
    id: string;
    nama: string;
  } | null>(null);
  const [focusedWilayah, setFocusedWilayah] = useState<WilayahSearchItem | null>(
    null,
  );
  const homeAgregat = useHomeAgregat();
  const legend = useMemo(() => getLegendRanges(metric), [metric]);

  /** Tingkat hirarki aktif untuk peta dan ringkasan. */
  const currentLevel: WilayahLevelKey = useMemo(() => {
    if (selectedDesa) return "desa";
    if (selectedKec) return "kecamatan";
    if (selectedKab) return "kabupaten";
    if (selected) return "provinsi";
    return "nasional";
  }, [selected, selectedKab, selectedKec, selectedDesa]);

  const provinceCode = useMemo(() => {
    if (!selected) return null;
    return String(selected.adminCode).padStart(2, "0");
  }, [selected]);

  const regencyCode = useMemo(() => {
    if (!selectedKab) return null;
    return selectedKab.id;
  }, [selectedKab]);

  const districtCode = useMemo(() => {
    if (!selectedKec) return null;
    return selectedKec.id;
  }, [selectedKec]);

  const villageCode = useMemo(() => {
    if (!selectedDesa) return null;
    return selectedDesa.id;
  }, [selectedDesa]);

  /** id_provinsi untuk API — bukan slug UI / adminCode BPS. */
  const selectedProvinsiApiId = useMemo(
    () => (selected ? getProvinsiApiId(selected) : null),
    [selected],
  );

  const scopeInput = useMemo(() => {
    if (selectedDesa) {
      return { tingkat: "kelurahan" as const, id: selectedDesa.id };
    }
    if (selectedKec) {
      return { tingkat: "kecamatan" as const, id: selectedKec.id };
    }
    if (selectedKab) {
      return { tingkat: "kabupaten" as const, id: selectedKab.id };
    }
    if (selectedProvinsiApiId) {
      return { tingkat: "provinsi" as const, id: selectedProvinsiApiId };
    }
    return { tingkat: null, id: null };
  }, [selectedDesa, selectedKec, selectedKab, selectedProvinsiApiId]);

  const scopedRingkasan = useRingkasanScope(scopeInput);
  const peringkatKab = usePeringkatKabupaten(selectedProvinsiApiId);
  const peringkatKec = usePeringkatKecamatan(selectedKab?.id ?? null);
  const peringkatKel = usePeringkatKelurahan(selectedKec?.id ?? null);

  /**
   * Ringkasan aktif untuk KPI/komposisi/rasio/indikator:
   * desa → kec → kab → provinsi → nasional (useHomeAgregat).
   */
  const activeRingkasan =
    selected || selectedKab || selectedKec || selectedDesa
      ? scopedRingkasan.ringkasan
      : homeAgregat.ringkasan;

  const kpiTotals = useMemo(() => {
    if (!activeRingkasan) return null;
    return {
      tpk: activeRingkasan.jumlahTPK,
      anggota: activeRingkasan.jumlahAnggota,
      pkb: activeRingkasan.jumlahPKB,
      krs: activeRingkasan.jumlahKRS,
    };
  }, [activeRingkasan]);

  const dataSource =
    activeRingkasan?.meta.source ??
    homeAgregat.ringkasan?.meta.source ??
    homeAgregat.peringkat?.meta.source ??
    null;

  const scopeLabel =
    selectedDesa?.nama ??
    selectedKec?.nama ??
    selectedKab?.nama ??
    selected?.name ??
    "Nasional";

  const thematicData = useMemo(() => {
    const unit = kpiCards.find((c) => c.key === metric)?.unit ?? "";

    const metricVal = (item: {
      tpk: number;
      pkb: number;
      krs: number;
      rasio?: number;
    }) =>
      metric === "tpk"
        ? item.tpk
        : metric === "pkb"
          ? item.pkb
          : metric === "krs"
            ? item.krs
            : item.tpk * 3;

    if (!selected) {
      // Nasional: prefer /api/peringkat/provinsi (live) → kode Kemendagri via adminCode
      const live = homeAgregat.peringkat?.items;
      if (live?.length) {
        return live
          .map((item) => {
            const prov = resolveProvinceFromPeringkatId(item.id, item.nama);
            const code =
              item.kode?.replace(/\D/g, "") ||
              (prov
                ? String(prov.adminCode).padStart(2, "0")
                : null);
            if (!code) return null;
            const val = metricVal(item);
            return {
              code,
              value: val,
              name: item.nama,
              label: `${item.nama}: ${formatNumber(val)} ${unit}`.trim(),
            };
          })
          .filter((row): row is NonNullable<typeof row> => row != null);
      }
      return provinces.map((p) => {
        const code = String(p.adminCode).padStart(2, "0");
        const val = p[metric] ?? 0;
        return {
          code,
          value: val,
          name: p.name,
          label: `${p.name}: ${formatNumber(val)} ${unit}`.trim(),
        };
      });
    }

    if (selected && !selectedKab && peringkatKab.payload?.items) {
      // Provinsi → kab: kode Kemendagri 4 digit bila ada; fallback id (MW name-match di halaman wilayah)
      return peringkatKab.payload.items.map((item) => {
        const val = metricVal(item);
        const code = item.kode?.replace(/\D/g, "") || item.id;
        return {
          code,
          value: val,
          name: item.nama,
          label: `${item.nama}: ${formatNumber(val)} ${unit}`.trim(),
        };
      });
    }

    if (selectedKab && !selectedKec && peringkatKec.payload?.items) {
      return peringkatKec.payload.items.map((item) => {
        const val = metricVal(item);
        const code = item.kode?.replace(/\D/g, "") || item.id;
        return {
          code,
          value: val,
          name: item.nama,
          label: `${item.nama}: ${formatNumber(val)} ${unit}`.trim(),
        };
      });
    }

    if (selectedKec && peringkatKel.payload?.items) {
      return peringkatKel.payload.items.map((item) => {
        const val = metricVal(item);
        const code = item.kode?.replace(/\D/g, "") || item.id;
        return {
          code,
          value: val,
          name: item.nama,
          label: `${item.nama}: ${formatNumber(val)} ${unit}`.trim(),
        };
      });
    }

    return [];
  }, [
    selected,
    selectedKab,
    selectedKec,
    metric,
    homeAgregat.peringkat,
    peringkatKab.payload,
    peringkatKec.payload,
    peringkatKel.payload,
  ]);

  const sasaranScope = useMemo(() => {
    if (!activeRingkasan) {
      return {
        scopeLabel,
        counts: {
          ibuHamil: 0,
          baduta: 0,
          balita: 0,
          jambanTidakLayak: 0,
          sumberAirTidakLayak: 0,
          rtlh: 0,
        } satisfies SasaranCounts,
      };
    }
    const ind = activeRingkasan.indikator;
    const counts: SasaranCounts = {
      ibuHamil: ind.bumil,
      baduta: ind.baduta,
      balita: ind.balita,
      jambanTidakLayak: ind.jambanTL,
      sumberAirTidakLayak: ind.airTL,
      rtlh: ind.rtlh ?? 0,
    };
    return { scopeLabel, counts };
  }, [activeRingkasan, scopeLabel]);

  const prioritas = useMemo(() => {
    if (!activeRingkasan) {
      return getPrioritasKomposisi(null);
    }
    const total = activeRingkasan.jumlahSasaran;
    return {
      scopeLabel,
      total,
      slices: slicesFromRingkasanPrioritas(
        activeRingkasan.komposisiPrioritas,
        total,
      ),
    };
  }, [activeRingkasan, scopeLabel]);

  const retryAgregat = () => {
    homeAgregat.refetch();
    if (scopeInput.id) {
      scopedRingkasan.refetch();
    }
    if (selectedProvinsiApiId) {
      peringkatKab.refetch();
    }
    if (demoParam) {
      router.replace("/", { scroll: false });
    }
  };

  /**
   * Status kartu ringkasan vs tabel peringkat dipisah agar empty ranking
   * tidak mengosongkan KPI. Query ?demo= tetap untuk smoke UI.
   * Saat provinsi dipilih, status mengikuti fetch scoped.
   */
  const ringkasanState: DemoUiState = useMemo(() => {
    const forced = parseDemoState(demoParam);
    if (demoParam && forced !== "ready") return forced;
    if (selected || selectedKab) {
      if (scopedRingkasan.status === "loading" || scopedRingkasan.status === "idle") {
        return "loading";
      }
      if (scopedRingkasan.status === "error") return "error";
      if (!scopedRingkasan.ringkasan) return "empty";
      return "ready";
    }
    if (homeAgregat.status === "loading") return "loading";
    if (homeAgregat.status === "error") return "error";
    if (!homeAgregat.ringkasan) return "empty";
    return "ready";
  }, [
    demoParam,
    selected,
    selectedKab,
    scopedRingkasan.status,
    scopedRingkasan.ringkasan,
    homeAgregat.status,
    homeAgregat.ringkasan,
  ]);

  const kabTableState: DemoUiState = useMemo(() => {
    if (!selected) return "ready";
    if (peringkatKab.status === "loading" || peringkatKab.status === "idle") {
      return "loading";
    }
    if (peringkatKab.status === "error") return "error";
    if (!peringkatKab.payload?.items?.length) return "empty";
    return "ready";
  }, [selected, peringkatKab.status, peringkatKab.payload]);

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
      if (item.level === "kabupaten_kota") {
        const kabApi = getKabupatenApiId(item.id);
        if (kabApi) {
          setSelectedKab({ id: kabApi, nama: item.name });
        }
      } else {
        setSelectedKab(null);
      }
    }
  }, [wilayahParam]);

  const clearFocus = () => {
    setFocusedWilayah(null);
    setSelected(null);
    setSelectedKab(null);
    setSelectedKec(null);
    setSelectedDesa(null);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  const clearKabupaten = () => {
    setSelectedKab(null);
    setSelectedKec(null);
    setSelectedDesa(null);
    setFocusedWilayah(null);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  const selectProvince = (province: Province) => {
    setFocusedWilayah(null);
    setSelectedKab(null);
    setSelectedKec(null);
    setSelectedDesa(null);
    setSelected(province);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  const selectKabupaten = (item: PeringkatKabupatenItem) => {
    setSelectedKab({ id: item.id, nama: item.nama });
    setSelectedKec(null);
    setSelectedDesa(null);
    setFocusedWilayah(null);
  };

  const handleDrillDown = (
    level: WilayahLevelKey,
    code: string,
    name: string,
  ) => {
    if (level === "provinsi") {
      const prov =
        provinces.find(
          (p) =>
            String(p.adminCode).padStart(2, "0") === code ||
            p.adminCode === Number(code),
        ) ||
        provinces.find(
          (p) =>
            p.name.toLowerCase() === name.toLowerCase() ||
            name.toLowerCase().includes(p.name.toLowerCase()),
        );
      if (prov) {
        selectProvince(prov);
      } else {
        const newProv: Province = {
          id: `prov-${code}`,
          adminCode: Number(code) || 0,
          name,
          capital: name,
          tpk: 0,
          anggota: 0,
          pkb: 0,
          krs: 0,
          baduta: 0,
          balita: 0,
          pus: 0,
          ibuHamil: 0,
        };
        selectProvince(newProv);
      }
    } else if (level === "kabupaten") {
      setSelectedKab({ id: code, nama: name });
      setSelectedKec(null);
      setSelectedDesa(null);
    } else if (level === "kecamatan") {
      setSelectedKec({ id: code, nama: name });
      setSelectedDesa(null);
    } else if (level === "desa") {
      setSelectedDesa({ id: code, nama: name });
    }
  };

  const handleNavigateToLevel = (level: WilayahLevelKey) => {
    if (level === "nasional") {
      clearFocus();
    } else if (level === "provinsi") {
      setSelectedKab(null);
      setSelectedKec(null);
      setSelectedDesa(null);
    } else if (level === "kabupaten") {
      setSelectedKec(null);
      setSelectedDesa(null);
    } else if (level === "kecamatan") {
      setSelectedDesa(null);
    }
  };

  const ringkasanErrorMessage = selectedKab
    ? scopedRingkasan.error ??
      "Ringkasan kabupaten/kota tidak dapat dimuat. Coba lagi atau hapus filter kab."
    : selected
      ? scopedRingkasan.error ??
        "Ringkasan provinsi tidak dapat dimuat. Coba lagi atau hapus pilihan wilayah."
      : homeAgregat.error ??
        "Kartu jumlah TPK, PKB, dan KRS tidak dapat dimuat. Coba lagi.";

  const ringkasanEmptyDescription = selectedKab
    ? `Agregat untuk ${selectedKab.nama} belum tersedia. Hapus filter kab atau muat ulang.`
    : selected
      ? `Agregat untuk ${selected.name} belum tersedia. Hapus pilihan wilayah atau muat ulang.`
      : "Agregat nasional belum tersedia. Muat ulang atau periksa sumber data.";

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
              title={
                selectedKab
                  ? `Gagal memuat ringkasan ${selectedKab.nama}`
                  : selected
                    ? `Gagal memuat ringkasan ${selected.name}`
                    : "Gagal memuat ringkasan"
              }
              description={ringkasanErrorMessage}
              onRetry={retryAgregat}
            />
          </div>
        ) : null}
        {ringkasanState === "empty" ? (
          <div className="design-card">
            <EmptyState
              title="Ringkasan masih kosong"
              description={ringkasanEmptyDescription}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  {selected ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-xl border-line"
                      onClick={clearFocus}
                    >
                      Kembali ke nasional
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-line"
                    onClick={retryAgregat}
                  >
                    Muat ulang
                  </Button>
                </div>
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
                    <span
                      suppressHydrationWarning
                      className="text-[2rem] leading-none font-extrabold tracking-tight text-navy tabular-nums sm:text-[2.25rem]"
                    >
                      {formatNumber(kpiTotals[card.key])}
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-slate-400">
                    {card.unit}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[9px] font-medium text-slate-400">
                    {note}
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

        {activeRingkasan ? (
          <SasaranIndikatorPanel
            scopeLabel={sasaranScope.scopeLabel}
            counts={sasaranScope.counts}
            dataSource={dataSource}
          />
        ) : null}

        {activeRingkasan ? (
          <RasioInsightPanels
            values={{
              jumlahTPK: activeRingkasan.jumlahTPK,
              jumlahKRS: activeRingkasan.jumlahKRS,
              jumlahPKB: activeRingkasan.jumlahPKB,
              rasioTPK_KRS: activeRingkasan.rasioTPK_KRS,
              rasioPKB_desa: activeRingkasan.rasioPKB_desa,
              warningBeban: activeRingkasan.warningBeban,
              sourceLabel:
                activeRingkasan.meta.source === "mock" ? "simulasi" : "live",
            }}
          />
        ) : null}
      </div>

      <div className="design-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
          <div>
            <div className="section-title">
              {selectedKab
                ? `Sebaran · ${selectedKab.nama}`
                : selected
                  ? `Sebaran · ${selected.name}`
                  : "Sebaran Nasional"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selectedKab
                ? "KPI mengikuti agregat kabupaten/kota — hapus filter kab untuk kembali ke provinsi"
                : selected
                  ? "KPI mengikuti agregat provinsi — pilih kab/kota di tabel bawah, atau tutup untuk nasional"
                  : "Klik provinsi untuk memfilter ringkasan KPI"}
            </div>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-primary">
            {metricLabels[metric]}
          </span>
        </div>

        <div className="relative mt-2">
          {mapDemoState === "loading" ? (
            <MapSkeleton />
          ) : (
            <ClientOnly fallback={<MapSkeleton />}>
              <MasterWilayahMap
                metric={metric}
                currentLevel={currentLevel}
                provinceCode={provinceCode}
                provinceName={selected?.name}
                regencyCode={regencyCode}
                regencyName={selectedKab?.nama}
                districtCode={districtCode}
                districtName={selectedKec?.nama}
                villageCode={villageCode}
                villageName={selectedDesa?.nama}
                thematicData={thematicData}
                kabupatenList={peringkatKab.payload?.items}
                kecamatanList={peringkatKec.payload?.items}
                kelurahanList={peringkatKel.payload?.items}
                onDrillDown={handleDrillDown}
                onNavigateToLevel={handleNavigateToLevel}
                onReset={clearFocus}
              />
            </ClientOnly>
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
            {metricLabels[metric]} • Master Wilayah API BKKBN • Drilldown sampai tingkat Desa/Kelurahan
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
        {selected ? (
          <KabupatenSebaranTable
            items={peringkatKab.payload?.items ?? null}
            selectedId={selectedKab?.id ?? null}
            onSelect={selectKabupaten}
            onClearKab={clearKabupaten}
            provinceName={selected.name}
            demoState={kabTableState}
            onRetry={() => peringkatKab.refetch()}
            dataSource={
              peringkatKab.payload?.meta.source ?? dataSource ?? null
            }
          />
        ) : (
          <ProvinceSebaranTable
            compact
            selectedId={null}
            onSelect={selectProvince}
            ranking={homeAgregat.peringkat?.items ?? null}
            dataSource={dataSource}
            demoState={peringkatState}
            onRetryDemo={retryAgregat}
          />
        )}
        <div className="flex min-w-0 flex-col gap-3">
          {activeRingkasan ? (
            <>
              <KomposisiTpkCard
                variant="compact"
                showDetailLink
                counts={activeRingkasan.komposisiTPK}
                totalAnggotaOverride={activeRingkasan.jumlahAnggota}
              />
              <KomposisiPrioritasCard
                scopeLabel={prioritas.scopeLabel}
                total={prioritas.total}
                slices={prioritas.slices}
                compact
              />
            </>
          ) : ringkasanState === "loading" ? (
            <div className="design-card space-y-3 p-6">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              <div className="mx-auto size-36 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
            </div>
          ) : null}
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
                {selectedKab
                  ? "Ringkasan kabupaten/kota"
                  : focusedWilayah
                    ? "Hasil pencarian wilayah"
                    : "Ringkasan wilayah"}
              </div>
              <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-navy">
                {selectedKab?.nama ?? focusedWilayah?.name ?? selected.name}
              </h2>
              {selectedKab ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-primary uppercase">
                    Kabupaten/Kota
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selected.name}
                  </span>
                </div>
              ) : focusedWilayah ? (
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
          {selectedKab ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Peta tetap menampilkan konteks provinsi{" "}
              <span className="font-bold text-navy">{selected.name}</span>.
              Angka KPI mengikuti agregat{" "}
              <span className="font-bold text-navy">{selectedKab.nama}</span>.
            </p>
          ) : focusedWilayah &&
            focusedWilayah.level !== "provinsi" &&
            focusedWilayah.level !== "kabupaten_kota" ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Peta menampilkan konteks provinsi{" "}
              <span className="font-bold text-navy">{selected.name}</span>.
              Agregat kecamatan/desa belum tersedia — filter sampai
              kabupaten/kota.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scopedRingkasan.status === "loading" || !kpiTotals ? (
              <>
                <SummaryStatSkeleton />
                <SummaryStatSkeleton />
                <SummaryStatSkeleton />
                <SummaryStatSkeleton />
              </>
            ) : scopedRingkasan.status === "error" ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <ErrorState
                  title="Gagal memuat angka wilayah"
                  description={ringkasanErrorMessage}
                  onRetry={retryAgregat}
                />
              </div>
            ) : (
              <>
                <SummaryStat
                  label="Jumlah TPK"
                  value={formatNumber(kpiTotals.tpk)}
                />
                <SummaryStat
                  label="Keluarga berisiko stunting"
                  value={formatNumber(kpiTotals.krs)}
                />
                <SummaryStat
                  label="Anggota TPK"
                  value={formatNumber(kpiTotals.anggota)}
                />
                <SummaryStat
                  label="Koordinator PKB/PLKB"
                  value={formatNumber(kpiTotals.pkb)}
                />
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="h-10 gap-2 rounded-xl bg-primary px-4 text-white shadow-[var(--shadow-button)] hover:bg-[var(--primary-dark)]"
            >
              <Link
                href={drilldownHrefForSelection(
                  selected.id,
                  focusedWilayah,
                  selectedKab,
                )}
              >
                {drilldownLabelForSelection(focusedWilayah, selectedKab)}
                <UsersRound className="size-4" aria-hidden />
              </Link>
            </Button>
            <Link
              href={
                selectedKab
                  ? `/wilayah/${selected.id}/tpk?kabupatenId=${encodeURIComponent(selectedKab.id)}`
                  : `/wilayah/${selected.id}/tpk`
              }
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Atau langsung daftar TPK
            </Link>
            {selectedKab ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-line"
                onClick={clearKabupaten}
              >
                Kembali ke provinsi
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-line"
              onClick={clearFocus}
            >
              Kembali ke nasional
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {dataSource === "postgres"
              ? selectedKab
                ? "Angka di atas mengikuti agregat live tingkat kabupaten/kota."
                : "Angka di atas mengikuti agregat live tingkat provinsi."
              : selectedKab
                ? "Angka di atas mengikuti agregat simulasi tingkat kabupaten/kota."
                : "Angka di atas mengikuti agregat simulasi tingkat provinsi."}{" "}
            Telusuri berjenjang: provinsi → kabupaten/kota → daftar TPK.
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

function SummaryStatSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-slate-50/70 px-4 py-4 sm:px-5">
      <div className="h-3 w-20 animate-pulse rounded bg-slate-200" aria-hidden />
      <div className="mt-2.5 h-6 w-24 animate-pulse rounded bg-slate-200" aria-hidden />
    </div>
  );
}

/** CTA hierarki: provinsi → kab list; kab → daftar TPK; kec/desa → daftar TPK. */
function drilldownHrefForSelection(
  provinceId: string,
  focused: WilayahSearchItem | null,
  kab: { id: string; nama: string } | null,
) {
  if (kab) {
    return `/wilayah/${provinceId}/tpk?kabupatenId=${encodeURIComponent(kab.id)}`;
  }
  if (!focused || focused.level === "provinsi") {
    return `/wilayah/${provinceId}`;
  }
  if (focused.level === "kabupaten_kota") {
    const apiId = getKabupatenApiId(focused.id);
    if (apiId) {
      return `/wilayah/${provinceId}/tpk?kabupatenId=${encodeURIComponent(apiId)}`;
    }
    return `/wilayah/${provinceId}/kab/${focused.id}`;
  }
  if (focused.level === "kecamatan" && focused.id.includes("-depok")) {
    return `/wilayah/${provinceId}/kab/kota-depok/kec/${focused.id}`;
  }
  if (focused.level === "kecamatan") {
    return `/wilayah/${provinceId}/tpk?kec=${encodeURIComponent(focused.id)}`;
  }
  return `/wilayah/${provinceId}`;
}

function drilldownLabelForSelection(
  focused: WilayahSearchItem | null,
  kab: { id: string; nama: string } | null,
) {
  if (kab) {
    return "Lihat daftar TPK di kab/kota";
  }
  if (!focused || focused.level === "provinsi") {
    return "Lihat daftar kabupaten/kota";
  }
  if (focused.level === "kabupaten_kota") {
    return "Lihat daftar TPK di kab/kota";
  }
  return "Lihat daftar TPK di kecamatan";
}
