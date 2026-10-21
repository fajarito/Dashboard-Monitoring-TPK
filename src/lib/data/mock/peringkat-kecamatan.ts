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
import { listMwDistricts } from "@/lib/master-wilayah-client";
import {
  findKabupatenAcrossProvinces,
  getKabupatenById,
} from "@/lib/wilayah-hierarchy-data";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 120;

function buildItemFromShare(
  id: string,
  nama: string,
  kode: string | null,
  share: number,
  kabTpk: number,
  kabKrs: number,
  kabSasaran: number,
) {
  const tpk = Math.max(1, Math.round(kabTpk * share));
  const krs = Math.max(20, Math.round(kabKrs * share));
  const keluargaSasaran = Math.max(30, Math.round(kabSasaran * share));
  const pkb = Math.max(1, Math.round(tpk * 0.15));
  const desa = Math.max(1, Math.round(tpk * 0.45));
  const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
  return {
    id,
    nama,
    tpk,
    anggota: Math.max(1, Math.round(tpk * 3)),
    pkb,
    desa,
    krs,
    keluargaSasaran,
    rasio: getKrsPerTpkRatio(tpk, krs),
    rasioPkbDesa,
    warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
    kode,
    indikator: {
      bumil: Math.round(krs * 0.3),
      baduta: Math.round(krs * 0.25),
      balita: Math.round(krs * 0.6),
      jambanTL: Math.round(krs * 0.35),
      airTL: Math.round(krs * 0.28),
      rtlh: Math.round(krs * 0.3),
    },
  };
}

/** Ranking kecamatan dalam satu kabupaten (mock hierarki + MW kode). */
export async function getPeringkatKecamatanMock(
  kabupatenIdRaw: string,
): Promise<PeringkatKecamatanPayload> {
  const trimmed = kabupatenIdRaw.trim();
  const slug =
    getKabupatenSlugByApiId(trimmed) ??
    (!/^\d+$/.test(trimmed) ? trimmed : null) ??
    "kota-depok";
  const resolvedKabId =
    trimmed.match(/^\d+$/)?.[0] ?? getKabupatenApiId(slug) ?? trimmed;

  const kab =
    findKabupatenAcrossProvinces(trimmed) ??
    findKabupatenAcrossProvinces(slug) ??
    getKabupatenById("jabar", "kota-depok");

  const kabTpk = Math.max(1, kab?.tpkCount ?? 100);
  const kabKrs = Math.max(1, kab?.krs ?? 1000);
  const kabSasaran = Math.max(1, kab?.keluargaSasaran ?? 1500);

  // Prefer daftar kecamatan Master Wilayah (kode Kemendagri 6 digit) bila kab punya kode.
  let items: ReturnType<typeof buildItemFromShare>[] = [];
  if (kab?.kode) {
    try {
      const mw = await listMwDistricts(kab.kode);
      if (mw.length > 0) {
        const rows = mw.slice(0, MAX_ROWS);
        const weights = rows.map((_, index) => 0.7 + ((index * 17) % 10) / 20);
        const wSum = weights.reduce((a, b) => a + b, 0);
        items = rows.map((d, index) =>
          buildItemFromShare(
            String(1000 + index),
            d.name,
            d.code,
            weights[index]! / wSum,
            kabTpk,
            kabKrs,
            kabSasaran,
          ),
        );
      }
    } catch {
      /* fallback hierarki lokal */
    }
  }

  if (items.length === 0) {
    const kecList = kab?.kecamatan ?? [];
    items = kecList
      .slice()
      .sort(
        (a, b) => b.tpkCount - a.tpkCount || a.name.localeCompare(b.name, "id"),
      )
      .slice(0, MAX_ROWS)
      .map((kec) => {
        const apiId = getKecamatanApiId(kec.id) ?? kec.id;
        const share = kabTpk > 0 ? kec.tpkCount / kabTpk : 0.1;
        return buildItemFromShare(
          String(apiId),
          kec.name,
          kec.kode ?? null,
          share,
          kabTpk,
          kabKrs,
          kabSasaran,
        );
      });
  }

  items.sort((a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"));

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
