import {
  getKrsPerTpkRatio,
  provinces,
} from "@/lib/map-data";

import type { DataSource, PeringkatProvinsiPayload } from "@/lib/data/types";
import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 40;

/** List ringan untuk tabel ranking — max 40 baris. */
export function getPeringkatProvinsiMock(): PeringkatProvinsiPayload {
  const items = provinces
    .slice()
    .sort((a, b) => b.tpk - a.tpk || a.name.localeCompare(b.name, "id"))
    .slice(0, MAX_ROWS)
    .map((province) => ({
      id: province.id,
      nama: province.name,
      tpk: province.tpk,
      krs: province.krs,
      rasio: getKrsPerTpkRatio(province.tpk, province.krs),
    }));

  return {
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}
