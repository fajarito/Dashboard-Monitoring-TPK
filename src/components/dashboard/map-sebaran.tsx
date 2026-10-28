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
import { KeluargaDetailModal } from "@/components/dashboard/keluarga-detail-modal";
import { KrsPinFilters } from "@/components/dashboard/krs-pin-filters";
import { NusantaraFreshHero } from "@/components/dashboard/nusantara-fresh-hero";
import { ProvinceSebaranTable } from "@/components/dashboard/province-sebaran-table";
import { QuickProvincePicks } from "@/components/dashboard/quick-province-picks";
import { RasioInsightPanels } from "@/components/dashboard/rasio-insight-panels";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { Button } from "@/components/ui/button";
import {
  prefetchHomeAgregat,
  prefetchMasterWilayahWidget,
  prefetchPeringkatKabupaten,
  prefetchPeringkatKecamatan,
} from "@/lib/client-api-cache";
import type {
  KrsPointItem,
  PeringkatKabupatenItem,
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";
import {
  prefetchHomeAgregatEarly,
  useHomeAgregat,
} from "@/lib/hooks/use-home-agregat";
import { useKrsPoints } from "@/lib/hooks/use-krs-points";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import {
  isValidKemendagriCode,
  normalizeKemendagriDigits,
  sanitizeKemendagriCode,
} from "@/lib/kemendagri-code";
import {
  buildThematicData,
  choroplethFormulaLabel,
  type MetricRow,
} from "@/lib/map-choropleth";
import {
  estimateDesaForProvince,
  formatNumber,
  getDesaPerPkbRatio,
  metricHelp,
  metricLabels,
  metricOptions,
  provinces,
  type MetricKey,
  type Province,
} from "@/lib/map-data";
import { getKeluargaSasaranForProvince } from "@/lib/sasaran-indikator";
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
import {
  getProvinceBackground,
  resolveHeroRegionCode,
} from "@/lib/province-background";

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
  /** id = API/postgres; kode = Kemendagri untuk Master Wilayah map (jangan campur). */
  const [selectedKab, setSelectedKab] = useState<{
    id: string;
    nama: string;
    kode?: string | null;
  } | null>(null);
  const [selectedKec, setSelectedKec] = useState<{
    id: string;
    nama: string;
    kode?: string | null;
  } | null>(null);
  const [selectedDesa, setSelectedDesa] = useState<{
    id: string;
    nama: string;
    kode?: string | null;
  } | null>(null);
  const [focusedWilayah, setFocusedWilayah] = useState<WilayahSearchItem | null>(
    null,
  );
  const homeAgregat = useHomeAgregat();

  /** Filter pin KRS — hanya aktif di level desa (home Peta Sebaran). */
  const [pinPrioritas, setPinPrioritas] = useState<TpkKeluargaPrioritas[]>([]);
  const [pinIndikator, setPinIndikator] = useState<
    TpkKeluargaIndikatorFilter[]
  >(["krs"]);
  const [pinValidCoords, setPinValidCoords] = useState(true);
  const [pinQ, setPinQ] = useState("");
  const [pinQDebounced, setPinQDebounced] = useState("");
  const [selectedPin, setSelectedPin] = useState<KrsPointItem | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setPinQDebounced(pinQ.trim()), 280);
    return () => window.clearTimeout(t);
  }, [pinQ]);

  // Prefetch paralel: agregat home + script MW — jangan tunggu map mount.
  useEffect(() => {
    prefetchHomeAgregatEarly();
    prefetchHomeAgregat();
    prefetchMasterWilayahWidget();
  }, []);

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
    return sanitizeKemendagriCode(
      "provinsi",
      String(selected.adminCode).padStart(2, "0"),
    );
  }, [selected]);

  /**
   * Hero foto mengikuti provinsi induk (atau nasional).
   * Drill kab/kec/desa tidak mengganti foto ke wilayah lain.
   */
  const heroBackground = useMemo(() => {
    const code = resolveHeroRegionCode({
      level: currentLevel,
      provinceAdminCode: selected?.adminCode ?? null,
    });
    return getProvinceBackground(code);
  }, [currentLevel, selected?.adminCode]);

  /** Kode Kemendagri untuk SDK map — bukan id internal peringkat. */
  const regencyCode = useMemo(() => {
    if (!selectedKab) return null;
    const fromKode = sanitizeKemendagriCode("kabupaten", selectedKab.kode);
    if (fromKode) return fromKode;
    return sanitizeKemendagriCode("kabupaten", selectedKab.id);
  }, [selectedKab]);

  const districtCode = useMemo(() => {
    if (!selectedKec) return null;
    const fromKode = sanitizeKemendagriCode("kecamatan", selectedKec.kode);
    if (fromKode) return fromKode;
    return sanitizeKemendagriCode("kecamatan", selectedKec.id);
  }, [selectedKec]);

  const villageCode = useMemo(() => {
    if (!selectedDesa) return null;
    const fromKode = sanitizeKemendagriCode("desa", selectedDesa.kode);
    if (fromKode) return fromKode;
    return sanitizeKemendagriCode("desa", selectedDesa.id);
  }, [selectedDesa]);

  /** id_provinsi untuk API — bukan slug UI / adminCode BPS. */
  const selectedProvinsiApiId = useMemo(
    () => (selected ? getProvinsiApiId(selected) : null),
    [selected],
  );

  /**
   * id_kelurahan untuk fetch pin — pakai id internal peringkat bila ada,
   * fallback ke id selectedDesa (bisa Kemendagri jika belum match).
   */
  const selectedKelurahanApiId = useMemo(() => {
    if (!selectedDesa) return null;
    return selectedDesa.id?.trim() || null;
  }, [selectedDesa]);

  const krsPins = useKrsPoints({
    enabled: currentLevel === "desa",
    kelurahanId: selectedKelurahanApiId,
    provinsiId: selectedProvinsiApiId,
    prioritas: pinPrioritas,
    indikator: pinIndikator,
    validCoordsOnly: pinValidCoords,
    q: pinQDebounced,
    limit: 1000,
  });

  const krsPointItems = useMemo(
    () => krsPins.payload?.items ?? [],
    [krsPins.payload?.items],
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

  const mapMetricRows = useMemo((): MetricRow[] => {
    const toRows = (
      items: Array<{
        id: string;
        nama: string;
        tpk: number;
        krs: number;
        pkb?: number;
        anggota?: number;
        keluargaSasaran?: number;
        desa?: number;
        rasio?: number;
        rasioPkbDesa?: number;
        kode?: string | null;
      }>,
      resolveCode?: (item: (typeof items)[number]) => string | null,
    ): MetricRow[] =>
      items.map((item) => ({
        id: item.id,
        nama: item.nama,
        tpk: item.tpk,
        krs: item.krs,
        pkb: item.pkb,
        anggota: item.anggota,
        keluargaSasaran: item.keluargaSasaran,
        desa: item.desa,
        rasio: item.rasio,
        rasioPkbDesa: item.rasioPkbDesa,
        // Jangan fallback ke id internal — itu bukan kode Kemendagri.
        kode:
          item.kode?.replace(/\D/g, "") ||
          resolveCode?.(item) ||
          null,
      }));

    if (!selected) {
      const live = homeAgregat.peringkat?.items;
      if (live?.length) {
        return toRows(live, (item) => {
          const prov = resolveProvinceFromPeringkatId(item.id, item.nama);
          return prov ? String(prov.adminCode).padStart(2, "0") : null;
        });
      }
      // Jangan campur mock ke peta saat loading/error, atau saat source postgres kosong.
      if (
        homeAgregat.status !== "ready" ||
        homeAgregat.peringkat?.meta.source === "postgres"
      ) {
        return [];
      }
      // Mode mock: seed dari provinces hanya jika peringkat mock belum tersedia.
      return provinces.map((p) => {
        const desa = estimateDesaForProvince(p);
        return {
          id: p.id,
          nama: p.name,
          tpk: p.tpk,
          krs: p.krs,
          pkb: p.pkb,
          anggota: p.anggota,
          keluargaSasaran: getKeluargaSasaranForProvince(p),
          desa,
          rasio: p.tpk > 0 ? p.krs / p.tpk : 0,
          rasioPkbDesa: getDesaPerPkbRatio(p.pkb, desa),
          kode: String(p.adminCode).padStart(2, "0"),
        };
      });
    }

    if (selected && !selectedKab && peringkatKab.payload?.items) {
      return toRows(peringkatKab.payload.items);
    }

    if (selectedKab && !selectedKec && peringkatKec.payload?.items) {
      return toRows(peringkatKec.payload.items);
    }

    if (selectedKec && peringkatKel.payload?.items) {
      return toRows(peringkatKel.payload.items);
    }

    return [];
  }, [
    selected,
    selectedKab,
    selectedKec,
    homeAgregat.status,
    homeAgregat.peringkat,
    peringkatKab.payload,
    peringkatKec.payload,
    peringkatKel.payload,
  ]);

  const thematicData = useMemo(() => {
    const emptyCodes = new Map<string, string>();
    return buildThematicData(mapMetricRows, metric, emptyCodes);
  }, [mapMetricRows, metric]);

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

  /**
   * Status data choropleth untuk overlay "Memuat indikator…".
   * Nasional → home peringkat; drill → peringkat kab/kec/kel sesuai level.
   */
  const mapIndicatorStatus = useMemo(():
    | "idle"
    | "loading"
    | "ready"
    | "error" => {
    if (mapDemoState === "loading") return "loading";
    if (mapDemoState === "error") return "error";
    if (!selected) {
      if (homeAgregat.status === "loading") return "loading";
      if (homeAgregat.status === "error") return "error";
      return "ready";
    }
    if (!selectedKab) {
      if (peringkatKab.status === "loading" || peringkatKab.status === "idle") {
        return "loading";
      }
      if (peringkatKab.status === "error") return "error";
      return "ready";
    }
    if (!selectedKec) {
      if (peringkatKec.status === "loading" || peringkatKec.status === "idle") {
        return "loading";
      }
      if (peringkatKec.status === "error") return "error";
      return "ready";
    }
    if (peringkatKel.status === "loading" || peringkatKel.status === "idle") {
      return "loading";
    }
    if (peringkatKel.status === "error") return "error";
    return "ready";
  }, [
    mapDemoState,
    selected,
    selectedKab,
    selectedKec,
    homeAgregat.status,
    peringkatKab.status,
    peringkatKec.status,
    peringkatKel.status,
  ]);

  const mapIndicatorError = useMemo(() => {
    if (!selected) return homeAgregat.error;
    if (!selectedKab) return peringkatKab.error;
    if (!selectedKec) return peringkatKec.error;
    return peringkatKel.error;
  }, [
    selected,
    selectedKab,
    selectedKec,
    homeAgregat.error,
    peringkatKab.error,
    peringkatKec.error,
    peringkatKel.error,
  ]);

  const retryMapIndicator = () => {
    if (!selected) {
      homeAgregat.refetch();
      return;
    }
    if (!selectedKab) {
      peringkatKab.refetch();
      return;
    }
    if (!selectedKec) {
      peringkatKec.refetch();
      return;
    }
    peringkatKel.refetch();
  };

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
          const kodeHint =
            sanitizeKemendagriCode("kabupaten", item.id) ||
            sanitizeKemendagriCode("kabupaten", kabApi);
          setSelectedKab({ id: kabApi, nama: item.name, kode: kodeHint });
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
    const apiId = getProvinsiApiId(province);
    if (apiId) prefetchPeringkatKabupaten(apiId);
    if (wilayahParam) {
      router.replace("/", { scroll: false });
    }
  };

  const selectKabupaten = (item: PeringkatKabupatenItem) => {
    setSelectedKab({
      id: item.id,
      nama: item.nama,
      kode: item.kode ?? null,
    });
    setSelectedKec(null);
    setSelectedDesa(null);
    setFocusedWilayah(null);
    prefetchPeringkatKecamatan(item.id);
  };

  const handleDrillDown = (
    level: WilayahLevelKey,
    code: string,
    name: string,
  ) => {
    const clean = normalizeKemendagriDigits(code);
    if (level === "provinsi") {
      if (!isValidKemendagriCode("provinsi", clean)) return;
      const prov =
        provinces.find(
          (p) =>
            String(p.adminCode).padStart(2, "0") === clean ||
            p.adminCode === Number(clean),
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
          id: `prov-${clean}`,
          adminCode: Number(clean) || 0,
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
      if (!isValidKemendagriCode("kabupaten", clean)) return;
      // Map butuh Kemendagri; ringkasan butuh id internal bila ada di peringkat.
      const match = peringkatKab.payload?.items?.find((item) => {
        const k = item.kode ? normalizeKemendagriDigits(item.kode) : "";
        return k === clean || item.nama.toLowerCase() === name.toLowerCase();
      });
      setSelectedKab({
        id: match?.id ?? clean,
        nama: name,
        kode: clean,
      });
      setSelectedKec(null);
      setSelectedDesa(null);
    } else if (level === "kecamatan") {
      if (!isValidKemendagriCode("kecamatan", clean)) return;
      const match = peringkatKec.payload?.items?.find((item) => {
        const k = item.kode ? normalizeKemendagriDigits(item.kode) : "";
        return k === clean || item.nama.toLowerCase() === name.toLowerCase();
      });
      setSelectedKec({
        id: match?.id ?? clean,
        nama: name,
        kode: clean,
      });
      setSelectedDesa(null);
    } else if (level === "desa") {
      if (!isValidKemendagriCode("desa", clean)) return;
      const match = peringkatKel.payload?.items?.find((item) => {
        const k = item.kode ? normalizeKemendagriDigits(item.kode) : "";
        return k === clean || item.nama.toLowerCase() === name.toLowerCase();
      });
      setSelectedDesa({
        id: match?.id ?? clean,
        nama: name,
        kode: clean,
      });
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
    <section className="animate-content-enter">
      {/*
        Foto = true page background (edge-to-edge main pane, NO hero frame).
        Satu shell continuous: judul+KPI mengambang di atas foto;
        mapZone sibling tanpa space-y agar tidak terbaca “kartu hero”.
        Soft fade → #F8FBFF menyatu ke zona peta.
      */}
      <NusantaraFreshHero
        background={heroBackground}
        belowPhoto={
          <>
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
          </>
        }
        mapZone={
          <div className="fresh-blue-map-shell overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 sm:px-6 sm:pt-5">
              <div>
                <div className="section-title" style={{ color: "#15315D" }}>
                  {selectedKab
                    ? `Sebaran · ${selectedKab.nama}`
                    : selected
                      ? `Sebaran · ${selected.name}`
                      : "Sebaran Nasional"}
                </div>
                <div className="mt-1 text-xs" style={{ color: "#526B8C" }}>
                  {selectedKab
                    ? "KPI mengikuti agregat kabupaten/kota — hapus filter kab untuk kembali ke provinsi"
                    : selected
                      ? "KPI mengikuti agregat provinsi — pilih kab/kota di tabel bawah, atau tutup untuk nasional"
                      : "Klik provinsi untuk memfilter ringkasan KPI"}
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-[#2563EB]">
                Warna: {choroplethFormulaLabel(metric)}
              </span>
            </div>

            {currentLevel === "desa" ? (
              <div className="px-5 pt-3 sm:px-6">
                <KrsPinFilters
                  prioritas={pinPrioritas}
                  indikator={pinIndikator}
                  validCoordsOnly={pinValidCoords}
                  q={pinQ}
                  onPrioritasChange={setPinPrioritas}
                  onIndikatorChange={setPinIndikator}
                  onValidCoordsOnlyChange={setPinValidCoords}
                  onQChange={setPinQ}
                  status={krsPins.status}
                  returned={krsPins.payload?.returned ?? 0}
                  total={krsPins.payload?.total ?? 0}
                  truncated={krsPins.payload?.truncated ?? false}
                  error={krsPins.error}
                  onRetry={krsPins.refetch}
                />
              </div>
            ) : null}

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
                    metricRows={mapMetricRows}
                    kabupatenList={peringkatKab.payload?.items}
                    kecamatanList={peringkatKec.payload?.items}
                    kelurahanList={peringkatKel.payload?.items}
                    onDrillDown={handleDrillDown}
                    onNavigateToLevel={handleNavigateToLevel}
                    onReset={clearFocus}
                    indicatorStatus={mapIndicatorStatus}
                    indicatorError={mapIndicatorError}
                    onRetryIndicator={retryMapIndicator}
                    krsPoints={
                      currentLevel === "desa" ? krsPointItems : []
                    }
                    clipPinsToVillage
                    onKrsPinClick={setSelectedPin}
                  />
                </ClientOnly>
              )}
            </div>

            <KeluargaDetailModal
              open={selectedPin != null}
              kki={selectedPin?.kki ?? null}
              provinsiId={
                selectedProvinsiApiId != null &&
                Number.isFinite(Number(selectedProvinsiApiId))
                  ? Number(selectedProvinsiApiId)
                  : null
              }
              fallbackNama={selectedPin?.namaKepalaKeluarga}
              onClose={() => setSelectedPin(null)}
            />

            <div className="mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
              <div className="text-[9px] text-slate-400">
                Legenda indikator di kanan bawah peta ·{" "}
                {choroplethFormulaLabel(metric)} · Master Wilayah API BKKBN
                {dataSource === "postgres"
                  ? " · KPI live"
                  : dataSource === "mock"
                    ? " · KPI simulasi"
                    : ""}
              </div>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-2.5">
          <div className="max-w-2xl">
            <div className="eyebrow" style={{ color: "#2563EB" }}>
              Fase 1 · Fondasi visual
            </div>
            <h1
              className="page-title"
              style={{
                color: "#15315D",
                textShadow:
                  "0 1px 0 rgba(255,255,255,0.9), 0 2px 10px rgba(255,255,255,0.55)",
              }}
            >
              Peta Sebaran TPK
            </h1>
            <p
              className="mt-1 max-w-2xl text-sm leading-relaxed"
              style={{
                color: "#526B8C",
                textShadow: "0 1px 0 rgba(255,255,255,0.75)",
              }}
            >
              Gambaran cepat sebaran Tim Pendamping Keluarga di seluruh Indonesia
              — siap dibaca pimpinan tanpa istilah rumit. Gunakan kolom cari di
              atas untuk menemukan wilayah hingga desa.
              {selected ? (
                <>
                  {" "}
                  Fokus foto:{" "}
                  <strong style={{ color: "#15315D" }}>
                    {heroBackground.province}
                  </strong>
                  {currentLevel !== "provinsi" && currentLevel !== "nasional"
                    ? " (provinsi induk)"
                    : null}
                  .
                </>
              ) : null}
            </p>
          </div>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-xl border-white/70 bg-white/80 text-[#15315D] shadow-sm backdrop-blur-md hover:border-blue-300 hover:bg-white/90"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
            >
              <Layers2 className="size-4 text-[#2563EB]" aria-hidden />
              Ganti Data Peta
            </Button>
            {pickerOpen ? (
              <div
                className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-[0_12px_36px_rgba(22,57,100,0.12)] backdrop-blur-md"
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
                        ? "bg-blue-50 text-[#2563EB]"
                        : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      setMetric(option);
                      setPickerOpen(false);
                    }}
                  >
                    <span className="text-sm font-bold">{metricLabels[option]}</span>
                    <span className="text-[11px] text-[#64748B]">
                      {metricHelp[option]}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {ringkasanState === "error" ? (
            <div className="fresh-blue-card p-4">
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
            <div className="fresh-blue-card p-4">
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
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
                    className={`fresh-blue-card group px-4 py-4 text-left sm:px-5 sm:py-4 ${
                      active ? "is-active" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="min-w-0 pr-1 text-[11px] leading-snug font-semibold tracking-[0.12em] uppercase"
                        style={{ color: "#577396" }}
                      >
                        {card.label}
                      </div>
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full ${card.color}`}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                      {ringkasanState === "loading" || !kpiTotals ? (
                        <span
                          className="mt-1 h-8 w-28 animate-pulse rounded-lg bg-slate-100/80"
                          aria-hidden
                        />
                      ) : (
                        <span
                          suppressHydrationWarning
                          className="text-[1.85rem] leading-none font-extrabold tracking-tight tabular-nums sm:text-[2rem]"
                          style={{ color: "#15315D" }}
                        >
                          {formatNumber(kpiTotals[card.key])}
                        </span>
                      )}
                      <span
                        className="text-[11px] font-medium"
                        style={{ color: "#64748B" }}
                      >
                        {card.unit}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className="truncate text-[9px] font-medium"
                        style={{ color: "#64748B" }}
                      >
                        {note}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider uppercase ${
                          active
                            ? "bg-blue-50 text-[#2563EB]"
                            : "bg-slate-50 text-[#64748B]"
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
        </div>
      </NusantaraFreshHero>

      <div className="mt-4 space-y-4">
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
      </div>
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
