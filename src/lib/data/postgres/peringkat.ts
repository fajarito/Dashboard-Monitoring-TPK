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
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import { resolveProvinceFromPeringkatId } from "@/lib/province-api-id";

const MAX_ROWS = 40;

type SigaProvRow = {
  id_provinsi: number;
  tpk: number;
  pkb: number;
  desa: number;
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

/**
 * SIGA — TPK + PKB + desa binaan per ProvinsiID.
 * Pola sama ringkasan: PKB Status=1, TRIM(PKBID), desa Status=1 join PKB aktif,
 * group by PKB.ProvinsiID. Tidak scan by_name.
 */
export const SQL_SIGA_PERINGKAT = `
WITH tpk AS (
  SELECT
    t."ProvinsiID" AS id_provinsi,
    COUNT(*)::int AS tpk
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
  GROUP BY t."ProvinsiID"
),
pkb_aktif AS (
  SELECT
    p."ProvinsiID" AS id_provinsi,
    TRIM(BOTH FROM p."PKBID") AS pkb_id
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
),
pkb AS (
  SELECT
    id_provinsi,
    COUNT(*)::int AS pkb
  FROM pkb_aktif
  GROUP BY id_provinsi
),
desa AS (
  SELECT
    pa.id_provinsi,
    COUNT(*)::int AS desa
  FROM "sigabaru"."dat_KelurahanDesaBinaan" b
  INNER JOIN pkb_aktif pa ON TRIM(BOTH FROM b."PKBID") = pa.pkb_id
  WHERE b."Status" = 1
  GROUP BY pa.id_provinsi
),
ids AS (
  SELECT id_provinsi FROM tpk
  UNION
  SELECT id_provinsi FROM pkb
  UNION
  SELECT id_provinsi FROM desa
)
SELECT
  i.id_provinsi,
  COALESCE(t.tpk, 0)::int AS tpk,
  COALESCE(p.pkb, 0)::int AS pkb,
  COALESCE(d.desa, 0)::int AS desa
FROM ids i
LEFT JOIN tpk t ON t.id_provinsi = i.id_provinsi
LEFT JOIN pkb p ON p.id_provinsi = i.id_provinsi
LEFT JOIN desa d ON d.id_provinsi = i.id_provinsi
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

  const sigaById = new Map<
    number,
    { tpk: number; pkb: number; desa: number }
  >();
  for (const row of siga.rows) {
    sigaById.set(toInt(row.id_provinsi), {
      tpk: toInt(row.tpk),
      pkb: toInt(row.pkb),
      desa: toInt(row.desa),
    });
  }

  const krsById = new Map<number, number>();
  for (const row of dwh.rows) {
    krsById.set(toInt(row.id_provinsi), toInt(row.krs));
  }

  const ids = Array.from(
    new Set([...sigaById.keys(), ...krsById.keys()]),
  ).filter((id) => id > 0);

  const namaById = new Map<number, string>();
  if (ids.length > 0) {
    const wilayah = await queryPool<WilayahRow>("wilayah", SQL_WILAYAH_NAMA, [
      ids,
    ]);
    for (const row of wilayah.rows) {
      namaById.set(
        toInt(row.id_provinsi),
        row.nama_provinsi?.trim() || `Provinsi ${row.id_provinsi}`,
      );
    }
  }

  const items: PeringkatProvinsiItem[] = ids
    .map((id) => {
      const sigaRow = sigaById.get(id);
      const tpk = sigaRow?.tpk ?? 0;
      const pkb = sigaRow?.pkb ?? 0;
      const desa = sigaRow?.desa ?? 0;
      const krs = krsById.get(id) ?? 0;
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      const nama = namaById.get(id) ?? `Provinsi ${id}`;
      const prov = resolveProvinceFromPeringkatId(String(id), nama);
      const kode =
        prov?.adminCode != null && prov.adminCode > 0
          ? String(prov.adminCode).padStart(2, "0")
          : null;
      return {
        id: String(id),
        nama,
        tpk,
        pkb,
        desa,
        krs,
        rasio: getKrsPerTpkRatio(tpk, krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        kode,
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
