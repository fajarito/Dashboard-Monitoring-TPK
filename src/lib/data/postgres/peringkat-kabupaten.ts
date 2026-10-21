import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  arePostgresPoolsConfigured,
  getDwhPeriode,
  queryPool,
} from "@/lib/data/postgres/pools";
import type {
  PeringkatKabupatenItem,
  PeringkatKabupatenPayload,
} from "@/lib/data/types";
import { composeKemendagriCode } from "@/lib/map-choropleth";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";

const MAX_ROWS = 80;

type SigaKabRow = {
  id_kabupaten: number;
  tpk: number;
  anggota: number;
  pkb: number;
  desa: number;
};

type DwhKabRow = {
  id_kabupaten: number;
  krs: string | number;
  keluarga_sasaran: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

type WilayahKabRow = {
  id_kabupaten: number;
  nama_kabupaten: string;
  depdagri_kabupaten: string | null;
  depdagri_provinsi: string | null;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseProvinsiIdParam(raw: string | null): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new PostgresDataError(
      "missing_provinsi_id",
      "Parameter provinsiId wajib (ProvinsiID / id_provinsi).",
      { status: 400 },
    );
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new PostgresDataError(
      "invalid_provinsi_id",
      `Parameter provinsiId tidak valid: "${trimmed}".`,
      { status: 400 },
    );
  }
  return n;
}

/** SIGA — TPK/PKB/desa per KabupatenID dalam satu ProvinsiID. */
export const SQL_SIGA_PERINGKAT_KAB = `
WITH tpk AS (
  SELECT
    t."KabupatenID" AS id_kabupaten,
    COUNT(DISTINCT t."TPKID")::int AS tpk
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND t."ProvinsiID" = $1
    AND t."KabupatenID" IS NOT NULL
  GROUP BY t."KabupatenID"
),
anggota AS (
  SELECT
    t."KabupatenID" AS id_kabupaten,
    COUNT(*)::int AS anggota
  FROM "sigabaru"."dat_AnggotaTPK" a
  INNER JOIN "sigabaru"."dat_TPK" t
    ON t."TPKID" = a."TPKID" AND t."Status" = 1
  WHERE t."ProvinsiID" = $1
    AND t."KabupatenID" IS NOT NULL
  GROUP BY t."KabupatenID"
),
pkb_aktif AS (
  SELECT
    p."KabupatenID" AS id_kabupaten,
    TRIM(BOTH FROM p."PKBID") AS pkb_id
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
    AND p."ProvinsiID" = $1
    AND p."KabupatenID" IS NOT NULL
),
pkb AS (
  SELECT
    id_kabupaten,
    COUNT(*)::int AS pkb
  FROM pkb_aktif
  GROUP BY id_kabupaten
),
desa AS (
  SELECT
    pa.id_kabupaten,
    COUNT(*)::int AS desa
  FROM "sigabaru"."dat_KelurahanDesaBinaan" b
  INNER JOIN pkb_aktif pa ON TRIM(BOTH FROM b."PKBID") = pa.pkb_id
  WHERE b."Status" = 1
  GROUP BY pa.id_kabupaten
),
ids AS (
  SELECT id_kabupaten FROM tpk
  UNION
  SELECT id_kabupaten FROM pkb
  UNION
  SELECT id_kabupaten FROM desa
  UNION
  SELECT id_kabupaten FROM anggota
)
SELECT
  i.id_kabupaten,
  COALESCE(t.tpk, 0)::int AS tpk,
  COALESCE(a.anggota, 0)::int AS anggota,
  COALESCE(p.pkb, 0)::int AS pkb,
  COALESCE(d.desa, 0)::int AS desa
FROM ids i
LEFT JOIN tpk t ON t.id_kabupaten = i.id_kabupaten
LEFT JOIN anggota a ON a.id_kabupaten = i.id_kabupaten
LEFT JOIN pkb p ON p.id_kabupaten = i.id_kabupaten
LEFT JOIN desa d ON d.id_kabupaten = i.id_kabupaten
`;

export const SQL_DWH_PERINGKAT_KAB = `
SELECT
  r."id_kabupaten" AS id_kabupaten,
  COALESCE(SUM(r."total_prioritas"), 0) AS krs,
  COALESCE(SUM(r."jumlah_keluarga_sasaran"), 0) AS keluarga_sasaran,
  COALESCE(SUM(r."pus_hamil"), 0) AS bumil,
  COALESCE(SUM(r."baduta"), 0) AS baduta,
  COALESCE(SUM(r."balita"), 0) AS balita,
  COALESCE(SUM(r."jamban_layak_tidak"), 0) AS jamban_tl,
  COALESCE(SUM(r."sumber_air_layak_tidak"), 0) AS air_tl
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $2
  AND r."id_provinsi" = $1
GROUP BY r."id_kabupaten"
`;

export const SQL_WILAYAH_NAMA_KAB = `
SELECT
  k."id_kabupaten",
  k."nama_kabupaten",
  k."depdagri_kabupaten",
  k."depdagri_provinsi"
FROM "pk2025"."v_kabupaten" k
WHERE k."id_kabupaten" = ANY($1::int[])
`;

export async function getPeringkatKabupatenPostgres(
  provinsiIdRaw: string,
): Promise<PeringkatKabupatenPayload> {
  if (!arePostgresPoolsConfigured()) {
    throw new PostgresDataError(
      "postgres_not_configured",
      "DATA_SOURCE=postgres tetapi pool SIGA/WILAYAH/DWH belum di-set.",
    );
  }

  const provinsiId = parseProvinsiIdParam(provinsiIdRaw);
  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaKabRow>("siga", SQL_SIGA_PERINGKAT_KAB, [provinsiId]),
    queryPool<DwhKabRow>("dwh", SQL_DWH_PERINGKAT_KAB, [provinsiId, periode]),
  ]);

  const sigaById = new Map<
    number,
    { tpk: number; anggota: number; pkb: number; desa: number }
  >();
  for (const row of siga.rows) {
    sigaById.set(toInt(row.id_kabupaten), {
      tpk: toInt(row.tpk),
      anggota: toInt(row.anggota),
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
    dwhById.set(toInt(row.id_kabupaten), {
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
  const kodeById = new Map<number, string>();
  if (ids.length > 0) {
    const wilayah = await queryPool<WilayahKabRow>(
      "wilayah",
      SQL_WILAYAH_NAMA_KAB,
      [ids],
    );
    for (const row of wilayah.rows) {
      const id = toInt(row.id_kabupaten);
      namaById.set(
        id,
        row.nama_kabupaten?.trim() || `Kabupaten ${row.id_kabupaten}`,
      );
      const kode = composeKemendagriCode({
        prov: row.depdagri_provinsi,
        kab: row.depdagri_kabupaten,
      });
      if (kode && kode.length === 4) kodeById.set(id, kode);
    }
  }

  const items: PeringkatKabupatenItem[] = ids
    .map((id) => {
      const sigaRow = sigaById.get(id);
      const dwhRow = dwhById.get(id);
      const tpk = sigaRow?.tpk ?? 0;
      const anggota = sigaRow?.anggota ?? 0;
      const pkb = sigaRow?.pkb ?? 0;
      const desa = sigaRow?.desa ?? 0;
      const krs = dwhRow?.krs ?? 0;
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      return {
        id: String(id),
        nama: namaById.get(id) ?? `Kabupaten ${id}`,
        tpk,
        anggota,
        pkb,
        desa,
        krs,
        keluargaSasaran: dwhRow?.keluargaSasaran ?? 0,
        rasio: getKrsPerTpkRatio(tpk, krs),
        rasioPkbDesa,
        warningBeban: rasioPkbDesa > PKB_DESA_IDEAL_MAX,
        kode: kodeById.get(id) ?? null,
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
    .sort(
      (a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"),
    )
    .slice(0, MAX_ROWS);

  return {
    provinsiId: String(provinsiId),
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
