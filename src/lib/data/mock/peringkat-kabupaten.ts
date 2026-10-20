import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  nationalDesaKelurahan,
  nationalTotals,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import {
  getProvinsiApiId,
  resolveProvinceFromRingkasanId,
} from "@/lib/province-api-id";
import { getKabupatenByProvince } from "@/lib/wilayah-hierarchy-data";

import type { DataSource, PeringkatKabupatenPayload } from "@/lib/data/types";
import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 80;

/** Ranking kab/kota dalam satu provinsi (mock hierarki). */
export function getPeringkatKabupatenMock(
  provinsiIdRaw: string,
): PeringkatKabupatenPayload {
  const province = resolveProvinceFromRingkasanId(provinsiIdRaw);
  const resolvedProvinsiId =
    (province ? getProvinsiApiId(province) : null) ??
    (provinsiIdRaw.trim().match(/^\d+$/) ? provinsiIdRaw.trim() : "12");

  const kabList = getKabupatenByProvince(province?.id ?? "jabar");
  const items = kabList
    .slice()
    .sort(
      (a, b) => b.tpkCount - a.tpkCount || a.name.localeCompare(b.name, "id"),
    )
    .slice(0, MAX_ROWS)
    .map((kab) => {
      const apiId = getKabupatenApiId(kab.id) ?? kab.id;
      const share =
        province && province.tpk > 0 ? kab.tpkCount / province.tpk : 0.05;
      const pkb = province
        ? Math.max(1, Math.round(province.pkb * share))
        : Math.max(1, Math.round(kab.tpkCount * 0.12));
      const desa = province
        ? Math.max(
            1,
            Math.round(
              nationalDesaKelurahan *
                (province.pkb / nationalTotals.pkb) *
                share,
            ),
          )
        : Math.max(1, Math.round(kab.tpkCount * 0.4));
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      const anggota = Math.max(1, Math.round(kab.tpkCount * 3));
      return {
        id: String(apiId),
        nama: kab.name,
        tpk: kab.tpkCount,
        anggota,
        pkb,
        desa,
        krs: kab.krs,
        keluargaSasaran: kab.keluargaSasaran,
        rasio: getKrsPerTpkRatio(kab.tpkCount, kab.krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        // Kemendagri 4-digit bila hierarki mock menyertakan (Jabar lengkap).
        kode: kab.kode ?? null,
        indikator: {
          bumil: kab.sasaran.ibuHamil,
          baduta: kab.sasaran.baduta,
          balita: kab.sasaran.balita,
          jambanTL: kab.sasaran.jambanTidakLayak,
          airTL: kab.sasaran.sumberAirTidakLayak,
          rtlh: kab.sasaran.rtlh,
        },
      };
    });

  return {
    provinsiId: resolvedProvinsiId,
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}
