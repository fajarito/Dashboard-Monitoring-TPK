import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
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
  lainnya: number;
};

type DwhRow = {
  jumlah_sasaran: string | number;
  jumlah_krs: string | number;
  prioritas_1: string | number;
  prioritas_2: string | number;
  prioritas_3: string | number;
  prioritas_4: string | number;
  bukan_prioritas: string | number;
  tidak_risiko_stunting: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

export type WilayahFilter = {
  provinsiId: number | null;
  kabupatenId: number | null;
  kecamatanId: number | null;
  kelurahanId: number | null;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

function parsePositiveInt(
  raw: string,
  field: string,
): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new PostgresDataError(
      `invalid_${field}`,
      `Parameter id tidak valid: "${raw}". Harus angka ${field}.`,
      { status: 400 },
    );
  }
  return n;
}

/**
 * Resolve filter wilayah untuk ringkasan.
 * - nasional → semua null
 * - provinsi → ProvinsiID / id_provinsi
 * - kabupaten → KabupatenID / id_kabupaten
 * - kecamatan → KecamatanID / id_kecamatan
 * - kelurahan → KelurahanID / id_kelurahan
 */
export function resolveWilayahFilter(query: RingkasanQuery): WilayahFilter {
  if (query.tingkat === "nasional") {
    return {
      provinsiId: null,
      kabupatenId: null,
      kecamatanId: null,
      kelurahanId: null,
    };
  }

  const raw = query.id?.trim();
  if (!raw) {
    const field =
      query.tingkat === "kelurahan"
        ? "KelurahanID / id_kelurahan"
        : query.tingkat === "kecamatan"
          ? "KecamatanID / id_kecamatan"
          : query.tingkat === "kabupaten"
            ? "KabupatenID / id_kabupaten"
            : "ProvinsiID / id_provinsi";
    const code =
      query.tingkat === "kelurahan"
        ? "missing_kelurahan_id"
        : query.tingkat === "kecamatan"
          ? "missing_kecamatan_id"
          : query.tingkat === "kabupaten"
            ? "missing_kabupaten_id"
            : "missing_provinsi_id";
    throw new PostgresDataError(
      code,
      `Parameter id wajib untuk tingkat=${query.tingkat} (${field}).`,
      { status: 400 },
    );
  }

  if (query.tingkat === "kelurahan") {
    return {
      provinsiId: null,
      kabupatenId: null,
      kecamatanId: null,
      kelurahanId: parsePositiveInt(raw, "KelurahanID / id_kelurahan"),
    };
  }

  if (query.tingkat === "kecamatan") {
    return {
      provinsiId: null,
      kabupatenId: null,
      kecamatanId: parsePositiveInt(raw, "KecamatanID / id_kecamatan"),
      kelurahanId: null,
    };
  }

  if (query.tingkat === "kabupaten") {
    return {
      provinsiId: null,
      kabupatenId: parsePositiveInt(raw, "KabupatenID / id_kabupaten"),
      kecamatanId: null,
      kelurahanId: null,
    };
  }

  return {
    provinsiId: parsePositiveInt(raw, "ProvinsiID / id_provinsi"),
    kabupatenId: null,
    kecamatanId: null,
    kelurahanId: null,
  };
}

/** @deprecated gunakan resolveWilayahFilter — tetap diekspor untuk kompatibilitas. */
export function resolveProvinsiFilter(query: RingkasanQuery): number | null {
  return resolveWilayahFilter(query).provinsiId;
}

/**
 * SIGA — agregat TPK / anggota / PKB / desa binaan + komposisi StatusTPK.
 * Filter: Status=1; DISTINCT TPKID; TRIM PKBID; tanpa by_name.
 * $1 = ProvinsiID, $2 = KabupatenID, $3 = KecamatanID, $4 = KelurahanID (nullable).
 */
export const SQL_SIGA_RINGKASAN = `
WITH tpk_aktif AS (
  SELECT DISTINCT t."TPKID"
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND ($1::int IS NULL OR t."ProvinsiID" = $1)
    AND ($2::int IS NULL OR t."KabupatenID" = $2)
    AND ($3::int IS NULL OR t."KecamatanID" = $3)
    AND ($4::int IS NULL OR t."KelurahanID" = $4)
),
anggota AS (
  SELECT
    COUNT(*)::int AS jumlah_anggota,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 1)::int AS bidan,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 2)::int AS pkk,
    COUNT(*) FILTER (WHERE a."StatusTPK" = 3)::int AS kader_kb,
    COUNT(*) FILTER (
      WHERE a."StatusTPK" IS NULL OR a."StatusTPK" NOT IN (1, 2, 3)
    )::int AS lainnya
  FROM "sigabaru"."dat_AnggotaTPK" a
  INNER JOIN tpk_aktif t ON t."TPKID" = a."TPKID"
),
pkb_aktif AS (
  SELECT DISTINCT TRIM(BOTH FROM p."PKBID") AS pkb_id
  FROM "sigabaru"."dat_PKB" p
  WHERE p."Status" = 1
    AND ($1::int IS NULL OR p."ProvinsiID" = $1)
    AND ($2::int IS NULL OR p."KabupatenID" = $2)
    AND ($3::int IS NULL OR p."KecamatanID" = $3)
    AND ($4::int IS NULL OR p."KelurahanID" = $4)
),
binaan AS (
  SELECT COUNT(*)::int AS jumlah_desa
  FROM "sigabaru"."dat_KelurahanDesaBinaan" b
  INNER JOIN pkb_aktif p ON TRIM(BOTH FROM b."PKBID") = p.pkb_id
  WHERE b."Status" = 1
    AND (
      $4::int IS NULL
      OR b."KelurahanID" = $4
    )
)
SELECT
  (SELECT COUNT(*)::int FROM tpk_aktif) AS jumlah_tpk,
  COALESCE(a.jumlah_anggota, 0) AS jumlah_anggota,
  (SELECT COUNT(*)::int FROM pkb_aktif) AS jumlah_pkb,
  COALESCE(b.jumlah_desa, 0) AS jumlah_desa,
  COALESCE(a.bidan, 0) AS bidan,
  COALESCE(a.pkk, 0) AS pkk,
  COALESCE(a.kader_kb, 0) AS kader_kb,
  COALESCE(a.lainnya, 0) AS lainnya
FROM anggota a
CROSS JOIN binaan b
`;

/**
 * DWH — SUM grain RT dari by_rekap (jangan SUM jml_klg_*_prov).
 * RTLH tidak ada di DWH → null di payload.
 * $1–$4 = id_provinsi/kabupaten/kecamatan/kelurahan, $5 = periode.
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
  COALESCE(SUM(r."tidak_risiko_stunting"), 0) AS tidak_risiko_stunting,
  COALESCE(SUM(r."pus_hamil"), 0) AS bumil,
  COALESCE(SUM(r."baduta"), 0) AS baduta,
  COALESCE(SUM(r."balita"), 0) AS balita,
  COALESCE(SUM(r."jamban_layak_tidak"), 0) AS jamban_tl,
  COALESCE(SUM(r."sumber_air_layak_tidak"), 0) AS air_tl
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $5
  AND ($1::int IS NULL OR r."id_provinsi" = $1)
  AND ($2::int IS NULL OR r."id_kabupaten" = $2)
  AND ($3::int IS NULL OR r."id_kecamatan" = $3)
  AND ($4::int IS NULL OR r."id_kelurahan" = $4)
`;

export async function getRingkasanPostgres(
  query: RingkasanQuery,
): Promise<RingkasanPayload> {
  if (!arePostgresPoolsConfigured()) {
    throw new PostgresDataError(
      "postgres_not_configured",
      "DATA_SOURCE=postgres tetapi pool SIGA/WILAYAH/DWH belum di-set.",
    );
  }

  const filter = resolveWilayahFilter(query);
  const periode = getDwhPeriode();

  const [siga, dwh] = await Promise.all([
    queryPool<SigaRow>("siga", SQL_SIGA_RINGKASAN, [
      filter.provinsiId,
      filter.kabupatenId,
      filter.kecamatanId,
      filter.kelurahanId,
    ]),
    queryPool<DwhRow>("dwh", SQL_DWH_RINGKASAN, [
      filter.provinsiId,
      filter.kabupatenId,
      filter.kecamatanId,
      filter.kelurahanId,
      periode,
    ]),
  ]);

  const s = siga.rows[0] ?? {
    jumlah_tpk: 0,
    jumlah_anggota: 0,
    jumlah_pkb: 0,
    jumlah_desa: 0,
    bidan: 0,
    pkk: 0,
    kader_kb: 0,
    lainnya: 0,
  };
  const d = dwh.rows[0];

  const jumlahTPK = toInt(s.jumlah_tpk);
  const jumlahAnggota = toInt(s.jumlah_anggota);
  const jumlahPKB = toInt(s.jumlah_pkb);
  const jumlahDesa = toInt(s.jumlah_desa);
  const jumlahKRS = toInt(d?.jumlah_krs);
  const jumlahSasaran = toInt(d?.jumlah_sasaran);
  const bidan = toInt(s.bidan);
  const pkk = toInt(s.pkk);
  const kaderKb = toInt(s.kader_kb);
  const lainnya = toInt(s.lainnya);

  const rasioTPK_KRS = getKrsPerTpkRatio(jumlahTPK, jumlahKRS);
  const rasioPKB_desa = getDesaPerPkbRatio(jumlahPKB, jumlahDesa);

  let tingkat: RingkasanPayload["tingkat"] = "nasional";
  let id: string | null = null;
  if (query.tingkat === "kelurahan" && filter.kelurahanId != null) {
    tingkat = "kelurahan";
    id = String(filter.kelurahanId);
  } else if (query.tingkat === "kecamatan" && filter.kecamatanId != null) {
    tingkat = "kecamatan";
    id = String(filter.kecamatanId);
  } else if (query.tingkat === "kabupaten" && filter.kabupatenId != null) {
    tingkat = "kabupaten";
    id = String(filter.kabupatenId);
  } else if (query.tingkat === "provinsi" && filter.provinsiId != null) {
    tingkat = "provinsi";
    id = String(filter.provinsiId);
  }

  return {
    tingkat,
    id,
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
      tidakRisiko: toInt(d?.tidak_risiko_stunting),
    },
    indikator: {
      bumil: toInt(d?.bumil),
      baduta: toInt(d?.baduta),
      balita: toInt(d?.balita),
      jambanTL: toInt(d?.jamban_tl),
      airTL: toInt(d?.air_tl),
      rtlh: null,
    },
    komposisiTPK: {
      bidan,
      pkk,
      kaderKb,
      lainnya,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
