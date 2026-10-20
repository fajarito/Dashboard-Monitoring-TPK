import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type {
  DataSource,
  PeringkatKecamatanPayload,
} from "@/lib/data/types";
import {
  getKabupatenApiId,
  getKabupatenSlugByApiId,
} from "@/lib/kabupaten-api-id";
import { getKecamatanApiId } from "@/lib/kecamatan-api-id";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import { getKabupatenById } from "@/lib/wilayah-hierarchy-data";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 120;

/** Ranking kecamatan dalam satu kabupaten (mock hierarki). */
export function getPeringkatKecamatanMock(
  kabupatenIdRaw: string,
): PeringkatKecamatanPayload {
  const trimmed = kabupatenIdRaw.trim();
  const slug =
    getKabupatenSlugByApiId(trimmed) ??
    (!/^\d+$/.test(trimmed) ? trimmed : null) ??
    "kota-depok";
  const resolvedKabId =
    trimmed.match(/^\d+$/)?.[0] ?? getKabupatenApiId(slug) ?? trimmed;

  const kab =
    getKabupatenById("jabar", slug) ??
    getKabupatenById("jabar", "kota-depok");

  const kecList = kab?.kecamatan ?? [];
  const items = kecList
    .slice()
    .sort(
      (a, b) => b.tpkCount - a.tpkCount || a.name.localeCompare(b.name, "id"),
    )
    .slice(0, MAX_ROWS)
    .map((kec) => {
      const apiId = getKecamatanApiId(kec.id) ?? kec.id;
      const pkb = Math.max(1, Math.round(kec.tpkCount * 0.15));
      const desa = Math.max(1, Math.round(kec.tpkCount * 0.45));
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      return {
        id: String(apiId),
        nama: kec.name,
        tpk: kec.tpkCount,
        pkb,
        desa,
        krs: kec.krs,
        keluargaSasaran: kec.keluargaSasaran,
        rasio: getKrsPerTpkRatio(kec.tpkCount, kec.krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        indikator: {
          bumil: kec.sasaran.ibuHamil,
          baduta: kec.sasaran.baduta,
          balita: kec.sasaran.balita,
          jambanTL: kec.sasaran.jambanTidakLayak,
          airTL: kec.sasaran.sumberAirTidakLayak,
          rtlh: kec.sasaran.rtlh,
        },
      };
    });

  return {
    kabupatenId: resolvedKabId,
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}
