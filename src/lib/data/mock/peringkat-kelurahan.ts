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
import { listMwVillages } from "@/lib/master-wilayah-client";
import { getTpkForScope } from "@/lib/tpk-drilldown-data";
import { getKabupatenById, getKecamatanById } from "@/lib/wilayah-hierarchy-data";

const SOURCE: DataSource = "mock";
const MAX_ROWS = 200;

function buildVillageItem(
  id: string,
  nama: string,
  kode: string | null,
  share: number,
  baseTpk: number,
  baseKrs: number,
  baseSasaran: number,
) {
  const tpk = Math.max(1, Math.round(baseTpk * share));
  const krs = Math.max(10, Math.round(baseKrs * share));
  const keluargaSasaran = Math.max(15, Math.round(baseSasaran * share));
  const pkb = Math.max(1, Math.round(tpk * 0.2));
  const desa = 1;
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
      balita: Math.round(krs * 0.55),
      jambanTL: Math.round(krs * 0.35),
      airTL: Math.round(krs * 0.28),
      rtlh: Math.round(krs * 0.3),
    },
  };
}

/**
 * Ranking desa/kelurahan dalam satu kecamatan (mock).
 * Prefer Master Wilayah villages (kode 10 digit) bila kecamatanCode diketahui.
 */
export async function getPeringkatKelurahanMock(
  kecamatanIdRaw: string,
): Promise<PeringkatKelurahanPayload> {
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

  // Jika id terlihat seperti kode Kemendagri 6 digit, pakai langsung.
  const maybeKode = trimmed.replace(/\D/g, "");
  const districtCode =
    maybeKode.length === 6
      ? maybeKode
      : kec?.kode?.replace(/\D/g, "") || null;

  let items: ReturnType<typeof buildVillageItem>[] = [];

  if (districtCode) {
    try {
      const mw = await listMwVillages(districtCode);
      if (mw.length > 0) {
        const baseTpk = Math.max(8, kec?.tpkCount ?? 40);
        const baseKrs = Math.max(80, kec?.krs ?? 800);
        const baseSasaran = Math.max(100, kec?.keluargaSasaran ?? 1200);
        const rows = mw.slice(0, MAX_ROWS);
        const weights = rows.map((_, i) => 0.65 + ((i * 13) % 10) / 25);
        const wSum = weights.reduce((a, b) => a + b, 0);
        items = rows.map((v, index) =>
          buildVillageItem(
            String(index + 1),
            v.name,
            v.code,
            weights[index]! / wSum,
            baseTpk,
            baseKrs,
            baseSasaran,
          ),
        );
      }
    } catch {
      /* fallback TPK list */
    }
  }

  if (items.length === 0) {
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

    items = Array.from(byDesa.values()).map((row, index) => {
      const id = String(
        Number.parseInt(resolvedKecId, 10) * 100 + index + 1 || index + 1,
      );
      return buildVillageItem(
        id,
        row.nama,
        null,
        1 / Math.max(1, byDesa.size),
        row.tpk * byDesa.size,
        row.krs * byDesa.size,
        row.keluargaSasaran * byDesa.size,
      );
    });
  }

  items.sort((a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"));
  items = items.slice(0, MAX_ROWS);

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
