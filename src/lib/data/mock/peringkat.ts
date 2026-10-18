import {
  estimateDesaForProvince,
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
  provinces,
} from "@/lib/map-data";
import { getProvinsiApiId } from "@/lib/province-api-id";

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
    .map((province) => {
      const desa = estimateDesaForProvince(province);
      const rasioPkbDesa = getDesaPerPkbRatio(province.pkb, desa);
      return {
        // id_provinsi (bukan slug / adminCode BPS) — selaras live + province-api-id.
        id: getProvinsiApiId(province) ?? province.id,
        nama: province.name,
        tpk: province.tpk,
        pkb: province.pkb,
        desa,
        krs: province.krs,
        rasio: getKrsPerTpkRatio(province.tpk, province.krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
      };
    });

  return {
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}
