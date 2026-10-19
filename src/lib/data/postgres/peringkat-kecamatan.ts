import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getPeringkatKecamatanMock } from "@/lib/data/mock/peringkat-kecamatan";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  arePostgresPoolsConfigured,
  getDwhPeriode,
  queryPool,
} from "@/lib/data/postgres/pools";
import type {
  PeringkatKecamatanItem,
  PeringkatKecamatanPayload,
} from "@/lib/data/types";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";

const MAX_ROWS = 120;

type SigaKecRow = {
  id_kecamatan: number;
  tpk: number;
  pkb: number;
  desa: number;
};

type DwhKecRow = {
  id_kecamatan: number;
  krs: string | number;
  keluarga_sasaran: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

type WilayahKecRow = {
  id_kecamatan: number;
  nama_kecamatan: string;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseKabupatenIdParam(raw: string | null): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new PostgresDataError(
      "missing_kabupaten_id",
      "Parameter kabupatenId wajib (KabupatenID / id_kabupaten).",
      { status: 400 },
    );
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new PostgresDataError(
      "invalid_kabupaten_id",
      `Parameter kabupatenId tidak valid: "${trimmed}".`,
      { status: 400 },
    );
  }
  return n;
}

/** SIGA — TPK/PKB/desa per KecamatanID dalam satu KabupatenID. */
export const SQL_SIGA_PERINGKAT_KEC = `
WITH tpk AS (
  SELECT
    t."KecamatanID" AS id_kecamatan,
    COUNT(DISTINCT t."TPKID")::int AS tpk,
    COUNT(DISTINCT t."KelurahanID")::int AS desa
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND t."KabupatenID" = $1
    AND t."KecamatanID" IS NOT NULL
  GROUP BY t."KecamatanID"
),
pkb AS (
  SELECT
    p."KecamatanID" AS id_kecamatan,
    COUNT(DISTINCT TRIM(BOTH FROM p."PKBID"))::int AS pkb
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
    AND p."KabupatenID" = $1
    AND p."KecamatanID" IS NOT NULL
  GROUP BY p."KecamatanID"
),
ids AS (
  SELECT id_kecamatan FROM tpk
  UNION
  SELECT id_kecamatan FROM pkb
)
SELECT
  i.id_kecamatan,
  COALESCE(t.tpk, 0)::int AS tpk,
  COALESCE(p.pkb, 0)::int AS pkb,
  COALESCE(t.desa, 0)::int AS desa
FROM ids i
LEFT JOIN tpk t ON t.id_kecamatan = i.id_kecamatan
LEFT JOIN pkb p ON p.id_kecamatan = i.id_kecamatan
`;

export const SQL_DWH_PERINGKAT_KEC = `
SELECT
  r."id_kecamatan" AS id_kecamatan,
  COALESCE(SUM(r."total_prioritas"), 0) AS krs,
  COALESCE(SUM(r."jumlah_keluarga_sasaran"), 0) AS keluarga_sasaran,
  COALESCE(SUM(r."pus_hamil"), 0) AS bumil,
  COALESCE(SUM(r."baduta"), 0) AS baduta,
  COALESCE(SUM(r."balita"), 0) AS balita,
  COALESCE(SUM(r."jamban_layak_tidak"), 0) AS jamban_tl,
  COALESCE(SUM(r."sumber_air_layak_tidak"), 0) AS air_tl
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $2
  AND r."id_kabupaten" = $1
GROUP BY r."id_kecamatan"
`;

export const SQL_WILAYAH_NAMA_KEC = `
SELECT
  k."id_kecamatan",
  k."nama_kecamatan"
FROM "pk2025"."v_kecamatan" k
WHERE k."id_kecamatan" = ANY($1::int[])
`;

export async function getPeringkatKecamatanPostgres(
  kabupatenIdRaw: string,
): Promise<PeringkatKecamatanPayload> {
  if (!arePostgresPoolsConfigured()) {
    return getPeringkatKecamatanMock(kabupatenIdRaw);
  }

  const kabupatenId = parseKabupatenIdParam(kabupatenIdRaw);
  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaKecRow>("siga", SQL_SIGA_PERINGKAT_KEC, [kabupatenId]),
    queryPool<DwhKecRow>("dwh", SQL_DWH_PERINGKAT_KEC, [kabupatenId, periode]),
  ]);

  const sigaById = new Map<
    number,
    { tpk: number; pkb: number; desa: number }
  >();
  for (const row of siga.rows) {
    sigaById.set(toInt(row.id_kecamatan), {
      tpk: toInt(row.tpk),
      pkb: toInt(row.pkb),
      desa: toInt(row.desa),
    });
  }

  const dwhById = new Map<
    number,
    {
      krs: number;
      keluargaSasaran: number;
      bumil: number;
      baduta: number;
      balita: number;
      jambanTL: number;
      airTL: number;
    }
  >();
  for (const row of dwh.rows) {
    dwhById.set(toInt(row.id_kecamatan), {
      krs: toInt(row.krs),
      keluargaSasaran: toInt(row.keluarga_sasaran),
      bumil: toInt(row.bumil),
      baduta: toInt(row.baduta),
      balita: toInt(row.balita),
      jambanTL: toInt(row.jamban_tl),
      airTL: toInt(row.air_tl),
    });
  }

  const ids = Array.from(
    new Set([...sigaById.keys(), ...dwhById.keys()]),
  ).filter((id) => id > 0);

  const namaById = new Map<number, string>();
  if (ids.length > 0) {
    const wilayah = await queryPool<WilayahKecRow>(
      "wilayah",
      SQL_WILAYAH_NAMA_KEC,
      [ids],
    );
    for (const row of wilayah.rows) {
      namaById.set(
        toInt(row.id_kecamatan),
        row.nama_kecamatan?.trim() || `Kecamatan ${row.id_kecamatan}`,
      );
    }
  }

  const items: PeringkatKecamatanItem[] = ids
    .map((id) => {
      const sigaRow = sigaById.get(id);
      const dwhRow = dwhById.get(id);
      const tpk = sigaRow?.tpk ?? 0;
      const pkb = sigaRow?.pkb ?? 0;
      const desa = sigaRow?.desa ?? 0;
      const krs = dwhRow?.krs ?? 0;
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      return {
        id: String(id),
        nama: namaById.get(id) ?? `Kecamatan ${id}`,
        tpk,
        pkb,
        desa,
        krs,
        keluargaSasaran: dwhRow?.keluargaSasaran ?? 0,
        rasio: getKrsPerTpkRatio(tpk, krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        indikator: {
          bumil: dwhRow?.bumil ?? 0,
          baduta: dwhRow?.baduta ?? 0,
          balita: dwhRow?.balita ?? 0,
          jambanTL: dwhRow?.jambanTL ?? 0,
          airTL: dwhRow?.airTL ?? 0,
          rtlh: null,
        },
      };
    })
    .sort((a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"))
    .slice(0, MAX_ROWS);

  return {
    kabupatenId: String(kabupatenId),
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
