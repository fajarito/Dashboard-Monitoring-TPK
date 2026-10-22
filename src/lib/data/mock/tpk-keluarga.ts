import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type {
  TpkKeluargaIndikatorFilter,
  TpkKeluargaItem,
  TpkKeluargaPayload,
  TpkKeluargaPrioritas,
  TpkKeluargaQuery,
} from "@/lib/data/types";
import { provinces } from "@/lib/map-data";
import {
  getTpkById,
  getTpkByProvince,
  type KeluargaBinaan,
  type TpkUnit,
} from "@/lib/tpk-drilldown-data";

function findMockTpk(tpkId: string): TpkUnit | null {
  const trimmed = tpkId.trim();
  if (!trimmed) return null;
  for (const province of provinces) {
    const tpk = getTpkById(province.id, trimmed);
    if (tpk) return tpk;
  }
  for (const province of provinces) {
    const hit = getTpkByProvince(province.id).find(
      (item) => item.id === trimmed,
    );
    if (hit) return hit;
  }
  return null;
}

function mapItem(kel: KeluargaBinaan): TpkKeluargaItem {
  return {
    id: kel.id,
    kodeKeluarga: kel.familyCode,
    namaKepalaKeluarga: kel.kepalaKeluarga,
    prioritas: kel.prioritas,
    indikator: {
      baduta: kel.indikator.baduta,
      balita: kel.indikator.balita,
      pus: kel.indikator.pus,
      ibuHamil: kel.indikator.ibuHamil,
      krs: kel.indikator.krs,
      jambanTidakLayak: kel.indikator.jambanTidakLayak,
      sumberAirTidakLayak: kel.indikator.sumberAirTidakLayak,
      rtlh: false,
    },
    latitude: null,
    longitude: null,
    namaKelurahan: null,
  };
}

function matchesIndikator(
  item: TpkKeluargaItem,
  filters: TpkKeluargaIndikatorFilter[],
): boolean {
  if (filters.length === 0) return true;
  return filters.every((key) => {
    if (key === "ibuHamil") return item.indikator.ibuHamil;
    if (key === "baduta") return item.indikator.baduta;
    if (key === "balita") return item.indikator.balita;
    if (key === "jambanTidakLayak") return item.indikator.jambanTidakLayak;
    if (key === "sumberAirTidakLayak")
      return item.indikator.sumberAirTidakLayak;
    if (key === "krs") return item.indikator.krs;
    return true;
  });
}

function matchesPrioritas(
  item: TpkKeluargaItem,
  filters: TpkKeluargaPrioritas[],
): boolean {
  if (filters.length === 0) return true;
  return filters.includes(item.prioritas);
}

const PRIORITAS_RANK: Record<TpkKeluargaPrioritas, number> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  bukan: 5,
  tidakRisiko: 6,
};

/**
 * Daftar keluarga mock — sumber drill-down simulasi, paging server-side.
 * Grain disimulasikan sebagai 1 TPK = 1 desa (tpkSeDesa dihitung di desa yang sama).
 */
export function getTpkKeluargaMock(
  tpkId: string,
  query: TpkKeluargaQuery,
): TpkKeluargaPayload | null {
  const tpk = findMockTpk(tpkId);
  if (!tpk) return null;

  const desa = tpk.desa?.trim() || null;
  const tpkSeDesa = getTpkByProvince(tpk.provinceId).filter(
    (item) =>
      (item.desa?.trim() || "").toLowerCase() === (desa || "").toLowerCase(),
  ).length;

  const filtered = tpk.keluarga
    .map(mapItem)
    .filter(
      (item) =>
        matchesPrioritas(item, query.prioritas) &&
        matchesIndikator(item, query.indikator),
    )
    .sort((a, b) => {
      const rank =
        PRIORITAS_RANK[a.prioritas] - PRIORITAS_RANK[b.prioritas];
      if (rank !== 0) return rank;
      return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga, "id");
    });

  // Dedup by kode (aman bila mock punya duplikat).
  const seen = new Set<string>();
  const unique = filtered.filter((item) => {
    if (seen.has(item.kodeKeluarga)) return false;
    seen.add(item.kodeKeluarga);
    return true;
  });

  const total = unique.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const start = (query.page - 1) * query.pageSize;
  const items = unique.slice(start, start + query.pageSize);

  return {
    tpkId: tpk.id,
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      prioritas: query.prioritas,
      indikator: query.indikator,
    },
    grain: {
      level: "kelurahan",
      kelurahanId: null,
      namaKelurahan: desa,
      tpkSeDesa: Math.max(1, tpkSeDesa),
      keluargaSasaranRekap: tpk.keluargaSasaran,
      krsRekap: tpk.krs,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "mock",
      generatedAt: new Date().toISOString(),
    },
  };
}
