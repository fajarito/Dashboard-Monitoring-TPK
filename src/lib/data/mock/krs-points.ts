import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { isValidIdCoords } from "@/lib/data/geo-coords";
import type {
  KrsPointItem,
  KrsPointsPayload,
  KrsPointsQuery,
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";
import { provinces } from "@/lib/map-data";
import {
  getTpkByProvince,
  type KeluargaBinaan,
  type TpkUnit,
} from "@/lib/tpk-drilldown-data";

/** Titik acuan mock — sekitar Beji, Depok (bukan data live). */
const MOCK_CENTER = { lat: -6.3755, lng: 106.8224 };

const PRIORITAS_RANK: Record<TpkKeluargaPrioritas, number> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  bukan: 5,
  tidakRisiko: 6,
};

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Jitter deterministik ~±0.012° (~1.3 km) agar pin tersebar di dalam desa. */
function coordsForKode(kode: string): { lat: number; lng: number } {
  const seed = hashSeed(kode);
  const latJitter = ((seed % 1000) / 1000 - 0.5) * 0.024;
  const lngJitter = ((((seed / 1000) | 0) % 1000) / 1000 - 0.5) * 0.024;
  return {
    lat: MOCK_CENTER.lat + latJitter,
    lng: MOCK_CENTER.lng + lngJitter,
  };
}

function matchesIndikator(
  kel: KeluargaBinaan,
  filters: TpkKeluargaIndikatorFilter[],
): boolean {
  if (filters.length === 0) return true;
  return filters.every((key) => {
    if (key === "ibuHamil") return kel.indikator.ibuHamil;
    if (key === "baduta") return kel.indikator.baduta;
    if (key === "balita") return kel.indikator.balita;
    if (key === "jambanTidakLayak") return kel.indikator.jambanTidakLayak;
    if (key === "sumberAirTidakLayak") return kel.indikator.sumberAirTidakLayak;
    if (key === "krs") return kel.indikator.krs;
    return true;
  });
}

function matchesPrioritas(
  kel: KeluargaBinaan,
  filters: TpkKeluargaPrioritas[],
): boolean {
  if (filters.length === 0) return true;
  return filters.includes(kel.prioritas);
}

function collectMockKeluarga(kelurahanId: number): {
  items: KeluargaBinaan[];
  desaName: string | null;
} {
  const out: KeluargaBinaan[] = [];
  const seen = new Set<string>();
  let desaName: string | null = null;

  for (const province of provinces) {
    const list = getTpkByProvince(province.id);
    for (const tpk of list) {
      // Mock tidak punya id_kelurahan numerik — pakai keluarga TPK kaya (Sukamaju)
      // untuk kelurahan id yang umum di demo (1660101) atau semua rich TPK.
      const rich = Boolean(tpk.keluarga?.length && tpk.keluarga.length >= 10);
      if (!rich) continue;
      if (
        kelurahanId !== 1660101 &&
        !String(tpk.id).includes(String(kelurahanId))
      ) {
        // Untuk id lain: tetap sediakan pin dari TPK rich pertama agar smoke jalan.
        if (out.length > 0) continue;
      }
      desaName = tpk.desa?.trim() || desaName;
      for (const kel of tpk.keluarga) {
        if (seen.has(kel.familyCode)) continue;
        seen.add(kel.familyCode);
        out.push(kel);
      }
    }
  }

  if (out.length === 0) {
    // Fallback: gabungkan semua keluarga mock.
    for (const province of provinces) {
      for (const tpk of getTpkByProvince(province.id) as TpkUnit[]) {
        desaName = tpk.desa?.trim() || desaName;
        for (const kel of tpk.keluarga) {
          if (seen.has(kel.familyCode)) continue;
          seen.add(kel.familyCode);
          out.push(kel);
        }
      }
    }
  }

  return { items: out, desaName };
}

/**
 * Pin KRS mock — koordinat sintetis di sekitar Beji agar overlay peta hidup tanpa DWH.
 */
export function getKrsPointsMock(query: KrsPointsQuery): KrsPointsPayload {
  const { items: raw, desaName } = collectMockKeluarga(query.kelurahanId);

  let filtered = raw.filter(
    (kel) =>
      matchesPrioritas(kel, query.prioritas) &&
      matchesIndikator(kel, query.indikator),
  );

  if (query.q) {
    const needle = query.q.toLowerCase();
    filtered = filtered.filter((kel) =>
      kel.kepalaKeluarga.toLowerCase().includes(needle),
    );
  }

  const mapped: KrsPointItem[] = [];
  for (const kel of filtered) {
    const { lat, lng } = coordsForKode(kel.familyCode);
    if (query.validCoordsOnly && !isValidIdCoords(lat, lng)) continue;
    if (query.bbox) {
      if (
        lat < query.bbox.south ||
        lat > query.bbox.north ||
        lng < query.bbox.west ||
        lng > query.bbox.east
      ) {
        continue;
      }
    }
    mapped.push({
      id: kel.familyCode,
      kodeKeluarga: kel.familyCode,
      namaKepalaKeluarga: kel.kepalaKeluarga,
      prioritas: kel.prioritas,
      krs: kel.indikator.krs,
      latitude: lat,
      longitude: lng,
    });
  }

  mapped.sort((a, b) => {
    const rank = PRIORITAS_RANK[a.prioritas] - PRIORITAS_RANK[b.prioritas];
    if (rank !== 0) return rank;
    return a.namaKepalaKeluarga.localeCompare(b.namaKepalaKeluarga, "id");
  });

  const total = mapped.length;
  const slice = mapped.slice(query.offset, query.offset + query.limit);

  return {
    items: slice,
    total,
    returned: slice.length,
    truncated: total > query.offset + slice.length,
    limit: query.limit,
    offset: query.offset,
    filters: {
      kelurahanId: query.kelurahanId,
      provinsiId: query.provinsiId,
      prioritas: query.prioritas,
      indikator: query.indikator,
      validCoordsOnly: query.validCoordsOnly,
      q: query.q,
      bbox: query.bbox,
    },
    grain: {
      level: "kelurahan",
      kelurahanId: query.kelurahanId,
      namaKelurahan: desaName,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "mock",
      generatedAt: new Date().toISOString(),
    },
  };
}
