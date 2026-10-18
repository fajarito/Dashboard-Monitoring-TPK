import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  arePostgresPoolsConfigured,
  getDwhPeriode,
  queryPool,
} from "@/lib/data/postgres/pools";
import type { RingkasanPayload, RingkasanQuery } from "@/lib/data/types";
import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";

type SigaRow = {
  jumlah_tpk: number;
  jumlah_anggota: number;
  jumlah_pkb: number;
  jumlah_desa: number;
  bidan: number;
  pkk: number;
  kader_kb: number;
};

type DwhRow = {
  jumlah_sasaran: string | number;
  jumlah_krs: string | number;
  prioritas_1: string | number;
  prioritas_2: string | number;
  prioritas_3: string | number;
  prioritas_4: string | number;
  bukan_prioritas: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse id provinsi untuk filter.
 * Nasional → null. Provinsi membutuhkan id numerik (ProvinsiID / id_provinsi).
 */
export function resolveProvinsiFilter(query: RingkasanQuery): number | null {
  if (query.tingkat !== "provinsi") return null;
  const raw = query.id?.trim();
  if (!raw) {
    throw new PostgresDataError(
      "missing_provinsi_id",
      "Parameter id wajib untuk tingkat=provinsi (ProvinsiID / id_provinsi).",
      { status: 400 },
    );
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    throw new PostgresDataError(
      "invalid_provinsi_id",
      `Parameter id tidak valid: "${raw}". Harus angka ProvinsiID / id_provinsi.`,
      { status: 400 },
    );
  }
  return n;
}

/**
 * SIGA — agregat TPK / anggota / PKB / desa binaan + komposisi StatusTPK.
 * Filter: Status=1; TRIM PKBID; tanpa by_name.
 */
export const SQL_SIGA_RINGKASAN = `
WITH tpk_aktif AS (
  SELECT t."TPKID"
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND ($1::int IS NULL OR t."ProvinsiID" = $1)
),
anggota AS (
  SELECT
    COUNT(*)::int AS jumlah_anggota,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 1)::int AS bidan,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 2)::int AS pkk,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 3)::int AS kader_kb
  FROM "sigabaru"."dat_AnggotaTPK" a
  INNER JOIN tpk_aktif t ON t."TPKID" = a."TPKID"
),
pkb_aktif AS (
  SELECT TRIM(BOTH FROM p."PKBID") AS pkb_id
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
    AND ($1::int IS NULL OR p."ProvinsiID" = $1)
),
binaan AS (
  SELECT COUNT(*)::int AS jumlah_desa
  FROM "sigabaru"."dat_KelurahanDesaBinaan" b
  INNER JOIN pkb_aktif p ON TRIM(BOTH FROM b."PKBID") = p.pkb_id
  WHERE b."Status" = 1
)
SELECT
  (SELECT COUNT(*)::int FROM tpk_aktif) AS jumlah_tpk,
  COALESCE(a.jumlah_anggota, 0) AS jumlah_anggota,
  (SELECT COUNT(*)::int FROM pkb_aktif) AS jumlah_pkb,
  COALESCE(b.jumlah_desa, 0) AS jumlah_desa,
  COALESCE(a.bidan, 0) AS bidan,
  COALESCE(a.pkk, 0) AS pkk,
  COALESCE(a.kader_kb, 0) AS kader_kb
FROM anggota a
CROSS JOIN binaan b
`;

/**
 * DWH — SUM grain RT dari by_rekap (jangan SUM jml_klg_*_prov).
 * RTLH tidak ada di DWH → null di payload.
 */
export const SQL_DWH_RINGKASAN = `
SELECT
  COALESCE(SUM(r."jumlah_keluarga_sasaran"), 0) AS jumlah_sasaran,
  COALESCE(SUM(r."total_prioritas"), 0) AS jumlah_krs,
  COALESCE(SUM(r."prioritas_1"), 0) AS prioritas_1,
  COALESCE(SUM(r."prioritas_2"), 0) AS prioritas_2,
  COALESCE(SUM(r."prioritas_3"), 0) AS prioritas_3,
  COALESCE(SUM(r."prioritas_4"), 0) AS prioritas_4,
  COALESCE(SUM(r."bukan_prioritas"), 0) AS bukan_prioritas,
  COALESCE(SUM(r."pus_hamil"), 0) AS bumil,
  COALESCE(SUM(r."baduta"), 0) AS baduta,
  COALESCE(SUM(r."balita"), 0) AS balita,
  COALESCE(SUM(r."jamban_layak_tidak"), 0) AS jamban_tl,
  COALESCE(SUM(r."sumber_air_layak_tidak"), 0) AS air_tl
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $2
  AND ($1::int IS NULL OR r."id_provinsi" = $1)
`;

export async function getRingkasanPostgres(
  query: RingkasanQuery,
): Promise<RingkasanPayload> {
  // Fallback mock HANYA jika URL pool kosong.
  if (!arePostgresPoolsConfigured()) {
    return getRingkasanMock(query);
  }

  const provinsiId = resolveProvinsiFilter(query);
  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaRow>("siga", SQL_SIGA_RINGKASAN, [provinsiId]),
    queryPool<DwhRow>("dwh", SQL_DWH_RINGKASAN, [provinsiId, periode]),
  ]);

  const s = siga.rows[0] ?? {
    jumlah_tpk: 0,
    jumlah_anggota: 0,
    jumlah_pkb: 0,
    jumlah_desa: 0,
    bidan: 0,
    pkk: 0,
    kader_kb: 0,
  };
  const d = dwh.rows[0];

  const jumlahTPK = toInt(s.jumlah_tpk);
  const jumlahAnggota = toInt(s.jumlah_anggota);
  const jumlahPKB = toInt(s.jumlah_pkb);
  const jumlahDesa = toInt(s.jumlah_desa);
  const jumlahKRS = toInt(d?.jumlah_krs);
  const jumlahSasaran = toInt(d?.jumlah_sasaran);

  const rasioTPK_KRS = getKrsPerTpkRatio(jumlahTPK, jumlahKRS);
  const rasioPKB_desa = getDesaPerPkbRatio(jumlahPKB, jumlahDesa);

  return {
    tingkat: query.tingkat === "provinsi" ? "provinsi" : "nasional",
    id:
      query.tingkat === "provinsi" && provinsiId != null
        ? String(provinsiId)
        : null,
    jumlahTPK,
    jumlahAnggota,
    jumlahPKB,
    jumlahKRS,
    jumlahSasaran,
    rasioTPK_KRS,
    rasioPKB_desa,
    warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
    komposisiPrioritas: {
      prioritas1: toInt(d?.prioritas_1),
      prioritas2: toInt(d?.prioritas_2),
      prioritas3: toInt(d?.prioritas_3),
      prioritas4: toInt(d?.prioritas_4),
      bukan: toInt(d?.bukan_prioritas),
    },
    indikator: {
      bumil: toInt(d?.bumil),
      baduta: toInt(d?.baduta),
      balita: toInt(d?.balita),
      jambanTL: toInt(d?.jamban_tl),
      airTL: toInt(d?.air_tl),
      // RTLH belum ada di DWH.
      rtlh: null,
    },
    komposisiTPK: {
      bidan: toInt(s.bidan),
      pkk: toInt(s.pkk),
      kaderKb: toInt(s.kader_kb),
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
