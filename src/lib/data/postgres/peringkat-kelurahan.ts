import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getPeringkatKelurahanMock } from "@/lib/data/mock/peringkat-kelurahan";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  arePostgresPoolsConfigured,
  getDwhPeriode,
  queryPool,
} from "@/lib/data/postgres/pools";
import type {
  PeringkatKelurahanItem,
  PeringkatKelurahanPayload,
} from "@/lib/data/types";
import { composeKemendagriCode } from "@/lib/map-choropleth";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";

const MAX_ROWS = 200;

type SigaKelRow = {
  id_kelurahan: number;
  tpk: number;
  pkb: number;
  desa: number;
};

type DwhKelRow = {
  id_kelurahan: number;
  krs: string | number;
  keluarga_sasaran: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

type WilayahKelRow = {
  id_kelurahan: number;
  nama_kelurahan: string;
  depdagri_kelurahan: string | null;
  depdagri_kecamatan: string | null;
  depdagri_kabupaten: string | null;
  depdagri_provinsi: string | null;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

export function parseKecamatanIdParam(raw: string | null): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new PostgresDataError(
      "missing_kecamatan_id",
      "Parameter kecamatanId wajib (KecamatanID / id_kecamatan).",
      { status: 400 },
    );
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new PostgresDataError(
      "invalid_kecamatan_id",
      `Parameter kecamatanId tidak valid: "${trimmed}".`,
      { status: 400 },
    );
  }
  return n;
}

/** SIGA — TPK/PKB per KelurahanID dalam satu KecamatanID. */
export const SQL_SIGA_PERINGKAT_KEL = `
WITH tpk AS (
  SELECT
    t."KelurahanID" AS id_kelurahan,
    COUNT(DISTINCT t."TPKID")::int AS tpk
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND t."KecamatanID" = $1
    AND t."KelurahanID" IS NOT NULL
  GROUP BY t."KelurahanID"
),
pkb AS (
  SELECT
    p."KelurahanID" AS id_kelurahan,
    COUNT(DISTINCT TRIM(BOTH FROM p."PKBID"))::int AS pkb
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
    AND p."KecamatanID" = $1
    AND p."KelurahanID" IS NOT NULL
  GROUP BY p."KelurahanID"
),
ids AS (
  SELECT id_kelurahan FROM tpk
  UNION
  SELECT id_kelurahan FROM pkb
)
SELECT
  i.id_kelurahan,
  COALESCE(t.tpk, 0)::int AS tpk,
  COALESCE(p.pkb, 0)::int AS pkb,
  1::int AS desa
FROM ids i
LEFT JOIN tpk t ON t.id_kelurahan = i.id_kelurahan
LEFT JOIN pkb p ON p.id_kelurahan = i.id_kelurahan
`;

export const SQL_DWH_PERINGKAT_KEL = `
SELECT
  r."id_kelurahan" AS id_kelurahan,
  COALESCE(SUM(r."total_prioritas"), 0) AS krs,
  COALESCE(SUM(r."jumlah_keluarga_sasaran"), 0) AS keluarga_sasaran,
  COALESCE(SUM(r."pus_hamil"), 0) AS bumil,
  COALESCE(SUM(r."baduta"), 0) AS baduta,
  COALESCE(SUM(r."balita"), 0) AS balita,
  COALESCE(SUM(r."jamban_layak_tidak"), 0) AS jamban_tl,
  COALESCE(SUM(r."sumber_air_layak_tidak"), 0) AS air_tl
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $2
  AND r."id_kecamatan" = $1
GROUP BY r."id_kelurahan"
`;

export const SQL_WILAYAH_NAMA_KEL = `
SELECT
  k."id_kelurahan",
  k."nama_kelurahan",
  COALESCE(k."depdagri_kelurahan", k."KodeDepdagri") AS depdagri_kelurahan,
  k."depdagri_kecamatan",
  k."depdagri_kabupaten",
  k."depdagri_provinsi"
FROM "pk2025"."v_kelurahan" k
WHERE k."id_kelurahan" = ANY($1::int[])
`;

export async function getPeringkatKelurahanPostgres(
  kecamatanIdRaw: string,
): Promise<PeringkatKelurahanPayload> {
  if (!arePostgresPoolsConfigured()) {
    return getPeringkatKelurahanMock(kecamatanIdRaw);
  }

  const kecamatanId = parseKecamatanIdParam(kecamatanIdRaw);
  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaKelRow>("siga", SQL_SIGA_PERINGKAT_KEL, [kecamatanId]),
    queryPool<DwhKelRow>("dwh", SQL_DWH_PERINGKAT_KEL, [kecamatanId, periode]),
  ]);

  const sigaById = new Map<
    number,
    { tpk: number; pkb: number; desa: number }
  >();
  for (const row of siga.rows) {
    sigaById.set(toInt(row.id_kelurahan), {
      tpk: toInt(row.tpk),
      pkb: toInt(row.pkb),
      desa: toInt(row.desa) || 1,
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
    dwhById.set(toInt(row.id_kelurahan), {
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
    const wilayah = await queryPool<WilayahKelRow>(
      "wilayah",
      SQL_WILAYAH_NAMA_KEL,
      [ids],
    );
    for (const row of wilayah.rows) {
      const id = toInt(row.id_kelurahan);
      namaById.set(
        id,
        row.nama_kelurahan?.trim() || `Kelurahan ${row.id_kelurahan}`,
      );
      const kode = composeKemendagriCode({
        prov: row.depdagri_provinsi,
        kab: row.depdagri_kabupaten,
        kec: row.depdagri_kecamatan,
        kel: row.depdagri_kelurahan,
      });
      if (kode && kode.length === 10) kodeById.set(id, kode);
    }
  }

  const items: PeringkatKelurahanItem[] = ids
    .map((id) => {
      const sigaRow = sigaById.get(id);
      const dwhRow = dwhById.get(id);
      const tpk = sigaRow?.tpk ?? 0;
      const pkb = sigaRow?.pkb ?? 0;
      const desa = sigaRow?.desa ?? 1;
      const krs = dwhRow?.krs ?? 0;
      const rasioPkbDesa = getDesaPerPkbRatio(pkb, desa);
      return {
        id: String(id),
        nama: namaById.get(id) ?? `Kelurahan ${id}`,
        tpk,
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
    .sort((a, b) => b.tpk - a.tpk || a.nama.localeCompare(b.nama, "id"))
    .slice(0, MAX_ROWS);

  return {
    kecamatanId: String(kecamatanId),
    items,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
