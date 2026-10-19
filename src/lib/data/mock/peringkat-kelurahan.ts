import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type {
  DataSource,
  PeringkatKelurahanPayload,
} from "@/lib/data/types";
import {
  getKecamatanApiId,
  getKecamatanSlugByApiId,
} from "@/lib/kecamatan-api-id";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import { getTpkForScope } from "@/lib/tpk-drilldown-data";
import { getKabupatenById, getKecamatanById } from "@/lib/wilayah-hierarchy-data";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 200;

/**
 * Ranking desa/kelurahan dalam satu kecamatan (mock).
 * Sumber: TPK simulasi di scope kecamatan, digulung per nama desa.
 */
export function getPeringkatKelurahanMock(
  kecamatanIdRaw: string,
): PeringkatKelurahanPayload {
  const trimmed = kecamatanIdRaw.trim();
  const slug =
    getKecamatanSlugByApiId(trimmed) ??
    (!/^\d+$/.test(trimmed) ? trimmed : null) ??
    "kec-beji-depok";
  const resolvedKecId =
    trimmed.match(/^\d+$/)?.[0] ?? getKecamatanApiId(slug) ?? trimmed;

  const kab = getKabupatenById("jabar", "kota-depok");
  const kec =
    (kab ? getKecamatanById("jabar", kab.id, slug) : null) ??
    getKecamatanById("jabar", "kota-depok", "kec-beji-depok");

  const tpkList = getTpkForScope({
    provinceId: "jabar",
    kabupatenId: kab?.id ?? "kota-depok",
    kecamatanId: kec?.id ?? slug,
  });

  const byDesa = new Map<
    string,
    {
      nama: string;
      tpk: number;
      krs: number;
      keluargaSasaran: number;
      bumil: number;
      baduta: number;
      balita: number;
      jambanTL: number;
      airTL: number;
      rtlh: number;
    }
  >();

  for (const tpk of tpkList) {
    const nama = tpk.desa?.trim() || tpk.name;
    const key = nama.toLowerCase();
    const prev = byDesa.get(key);
    if (!prev) {
      byDesa.set(key, {
        nama,
        tpk: 1,
        krs: tpk.krs,
        keluargaSasaran: tpk.keluargaSasaran,
        bumil: tpk.sasaran.ibuHamil,
        baduta: tpk.sasaran.baduta,
        balita: tpk.sasaran.balita,
        jambanTL: tpk.sasaran.jambanTidakLayak,
        airTL: tpk.sasaran.sumberAirTidakLayak,
        rtlh: tpk.sasaran.rtlh,
      });
    } else {
      prev.tpk += 1;
      prev.krs += tpk.krs;
      prev.keluargaSasaran += tpk.keluargaSasaran;
      prev.bumil += tpk.sasaran.ibuHamil;
      prev.baduta += tpk.sasaran.baduta;
      prev.balita += tpk.sasaran.balita;
      prev.jambanTL += tpk.sasaran.jambanTidakLayak;
      prev.airTL += tpk.sasaran.sumberAirTidakLayak;
      prev.rtlh += tpk.sasaran.rtlh;
    }
  }

  const items = Array.from(byDesa.values())
    .map((row, index) => {
      const id = String(
        Number.parseInt(resolvedKecId, 10) * 100 + index + 1 || index + 1,
      );
      const pkb = Math.max(1, Math.round(row.tpk * 0.2));
      const desa = 1;
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      return {
        id,
        nama: row.nama,
        tpk: row.tpk,
        pkb,
        desa,
        krs: row.krs,
        keluargaSasaran: row.keluargaSasaran,
        rasio: getKrsPerTpkRatio(row.tpk, row.krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        indikator: {
          bumil: row.bumil,
          baduta: row.baduta,
          balita: row.balita,
          jambanTL: row.jambanTL,
          airTL: row.airTL,
          rtlh: row.rtlh,
        },
      };
    })
    .sort((a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"))
    .slice(0, MAX_ROWS);

  return {
    kecamatanId: resolvedKecId,
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}
