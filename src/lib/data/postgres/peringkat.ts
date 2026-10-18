import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import {
  arePostgresPoolsConfigured,
  getDwhPeriode,
  queryPool,
} from "@/lib/data/postgres/pools";
import type {
  PeringkatProvinsiItem,
  PeringkatProvinsiPayload,
} from "@/lib/data/types";
import { getKrsPerTpkRatio } from "@/lib/map-data";

const MAX_ROWS = 40;

type SigaProvRow = {
  id_provinsi: number;
  tpk: number;
};

type DwhProvRow = {
  id_provinsi: number;
  krs: string | number;
};

type WilayahRow = {
  id_provinsi: number;
  nama_provinsi: string;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** SIGA — COUNT TPK aktif per ProvinsiID. */
export const SQL_SIGA_PERINGKAT = `
SELECT
  t."ProvinsiID" AS id_provinsi,
  COUNT(*)::int AS tpk
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
GROUP BY t."ProvinsiID"
`;

/** DWH — SUM total_prioritas (KRS) grain RT per id_provinsi. */
export const SQL_DWH_PERINGKAT = `
SELECT
  r."id_provinsi" AS id_provinsi,
  COALESCE(SUM(r."total_prioritas"), 0) AS krs
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $1
GROUP BY r."id_provinsi"
`;

/** WILAYAH — batch nama dari v_provinsi. */
export const SQL_WILAYAH_NAMA = `
SELECT
  p."id_provinsi",
  p."nama_provinsi"
FROM "pk2025"."v_provinsi" p
WHERE p."id_provinsi" = ANY($1::int[])
`;

/**
 * Adapter Postgres untuk peringkat provinsi (max 40 baris).
 * Fallback mock HANYA jika URL pool kosong; gagal query → throw (503).
 */
export async function getPeringkatProvinsiPostgres(): Promise<PeringkatProvinsiPayload> {
  if (!arePostgresPoolsConfigured()) {
    return getPeringkatProvinsiMock();
  }

  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaProvRow>("siga", SQL_SIGA_PERINGKAT),
    queryPool<DwhProvRow>("dwh", SQL_DWH_PERINGKAT, [periode]),
  ]);

  const tpkById = new Map<number, number>();
  for (const row of siga.rows) {
    tpkById.set(toInt(row.id_provinsi), toInt(row.tpk));
  }

  const krsById = new Map<number, number>();
  for (const row of dwh.rows) {
    krsById.set(toInt(row.id_provinsi), toInt(row.krs));
  }

  const ids = Array.from(
    new Set([...tpkById.keys(), ...krsById.keys()]),
  ).filter((id) => id > 0);

  const namaById = new Map<number, string>();
  if (ids.length > 0) {
    const wilayah = await queryPool<WilayahRow>("wilayah", SQL_WILAYAH_NAMA, [
      ids,
    ]);
    for (const row of wilayah.rows) {
      namaById.set(toInt(row.id_provinsi), row.nama_provinsi?.trim() || `Provinsi ${row.id_provinsi}`);
    }
  }

  const items: PeringkatProvinsiItem[] = ids
    .map((id) => {
      const tpk = tpkById.get(id) ?? 0;
      const krs = krsById.get(id) ?? 0;
      return {
        id: String(id),
        nama: namaById.get(id) ?? `Provinsi ${id}`,
        tpk,
        krs,
        rasio: getKrsPerTpkRatio(tpk, krs),
      };
    })
    .sort(
      (a, b) =>
        b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"),
    )
    .slice(0, MAX_ROWS);

  return {
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
