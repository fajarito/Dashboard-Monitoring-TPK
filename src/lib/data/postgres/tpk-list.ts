import {
  cacheKey,
  DEFAULT_CACHE_TTL_SEC,
  getCached,
  setCached,
} from "@/lib/data/cache";
import { blankIndikatorFields, getTpkListMock } from "@/lib/data/mock/tpk-list";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  getDwhPeriode,
  getPoolConfigs,
  queryPool,
} from "@/lib/data/postgres/pools";
import type {
  TpkListIndikator,
  TpkListItem,
  TpkListPayload,
  TpkListPkb,
  TpkListQuery,
  TpkListSort,
} from "@/lib/data/types";
import { dedupeByTpkId } from "@/lib/tpk-display-name";

type CountRow = { total: string | number };

type SigaTpkRow = {
  tpkid: string;
  namatpk: string | null;
  nomorregister: string | null;
  kodetpk: string | null;
  alamat: string | null;
  provinsiid: number | null;
  kabupatenid: number | null;
  kecamatanid: number | null;
  kelurahanid: number | null;
  status: number | null;
  jumlah_anggota: number;
};

type SigaIdRow = {
  tpkid: string;
  kelurahanid: number | null;
  namatpk: string | null;
  nomorregister: string | null;
};

type KelurahanNamaRow = {
  id_kelurahan: number;
  nama_kelurahan: string;
};

/** Hasil resolve nama desa di host wilayah (scoped). */
export type KelurahanSearchMatch = {
  /** Semua id yang nama desanya partial-match q. */
  allIds: number[];
  /** Subset yang nama desanya prefix-match q (relevansi lebih tinggi). */
  prefixIds: Set<number>;
};

type NamaKabRow = { id_kabupaten: number; nama_kabupaten: string };
type NamaKecRow = { id_kecamatan: number; nama_kecamatan: string };
type NamaKelRow = { id_kelurahan: number; nama_kelurahan: string };

type KelurahanRekapRow = {
  id_kelurahan: number;
  keluarga_sasaran: string | number;
  krs: string | number;
  bumil: string | number;
  baduta: string | number;
  balita: string | number;
  jamban_tl: string | number;
  air_tl: string | number;
};

export type KelurahanRekap = {
  keluargaSasaran: number;
  krs: number;
  bumil: number;
  baduta: number;
  balita: number;
  jambanTL: number;
  airTL: number;
};

type PkbJoinRow = {
  kelurahanid: number;
  pkbid: string;
  nama: string | null;
  nik: string | null;
  nohp: string | null;
  jabatan_tipe: number | null;
  jabatan_pkb: string | null;
  jabatan_plkb: string | null;
};

type AnggotaRow = {
  tpkid: string;
  nama: string | null;
  status_tpk: number | null;
  nomor_urut: number | null;
};

type TpkSeDesaRow = {
  kelurahanid: number;
  n: string | number;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** SIGA saja cukup untuk list; wilayah/DWH opsional untuk nama + indikator. */
export function isSigaConfigured(): boolean {
  return getPoolConfigs().siga.ready;
}

/**
 * Predikat cari `q` dalam scope wilayah ($1–$4).
 * $5 = teks q (NULL = tanpa filter cari).
 * $6 = id_kelurahan yang nama desanya cocok (dari host wilayah; boleh kosong).
 * Match: NomorRegister, NamaTPK, desa (via $6), nama anggota, nama PKB binaan.
 * Tidak scan by_name DWH.
 */
export const SQL_TPK_SEARCH_PREDICATE = `
  (
    $5::text IS NULL
    OR t."NomorRegister" ILIKE '%' || $5 || '%'
    OR t."NamaTPK" ILIKE '%' || $5 || '%'
    OR (
      cardinality(COALESCE($6::int[], ARRAY[]::int[])) > 0
      AND t."KelurahanID" = ANY(COALESCE($6::int[], ARRAY[]::int[]))
    )
    OR EXISTS (
      SELECT 1
      FROM "sigabaru"."dat_AnggotaTPK" a
      WHERE a."TPKID" = t."TPKID"
        AND a."Nama" ILIKE '%' || $5 || '%'
    )
    OR EXISTS (
      SELECT 1
      FROM "sigabaru"."dat_KelurahanDesaBinaan" b
      INNER JOIN "sigabaru"."dat_PKB" p
        ON TRIM(BOTH FROM p."PKBID") = TRIM(BOTH FROM b."PKBID")
      WHERE b."KelurahanID" = t."KelurahanID"
        AND b."Status" = 1
        AND p."Status" = 1
        AND p."NamaPetugas" ILIKE '%' || $5 || '%'
    )
  )
`;

/**
 * Total = DISTINCT TPKID (Status=1, scoped).
 * Constraint upsert hanya UNIQUE(TPKID, KodeTPK, NomorRegister) — TPKID bisa
 * muncul lebih dari sekali; COUNT(*) akan menggelembungkan counter.
 */
export const SQL_TPK_COUNT = `
SELECT COUNT(DISTINCT t."TPKID")::int AS total
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND ($1::int IS NULL OR t."ProvinsiID" = $1)
  AND ($2::int IS NULL OR t."KabupatenID" = $2)
  AND ($3::int IS NULL OR t."KecamatanID" = $3)
  AND ($4::int IS NULL OR t."KelurahanID" = $4)
  AND ${SQL_TPK_SEARCH_PREDICATE}
`;

/**
 * Halaman TPK aktif — tepat satu baris per TPKID.
 * PKB / rekap DWH tidak di-JOIN di sini (hindari fan-out); di-attach lewat map
 * setelah fetch. Urutan nama A–Z di outer query.
 */
export const SQL_TPK_PAGE = `
SELECT *
FROM (
  SELECT DISTINCT ON (t."TPKID")
    t."TPKID" AS tpkid,
    t."NamaTPK" AS namatpk,
    t."NomorRegister" AS nomorregister,
    t."KodeTPK" AS kodetpk,
    t."Alamat" AS alamat,
    t."ProvinsiID" AS provinsiid,
    t."KabupatenID" AS kabupatenid,
    t."KecamatanID" AS kecamatanid,
    t."KelurahanID" AS kelurahanid,
    t."Status" AS status,
    (
      SELECT COUNT(*)::int
      FROM "sigabaru"."dat_AnggotaTPK" a
      WHERE a."TPKID" = t."TPKID"
    ) AS jumlah_anggota
  FROM "sigabaru"."dat_TPK" t
  WHERE t."Status" = 1
    AND ($1::int IS NULL OR t."ProvinsiID" = $1)
    AND ($2::int IS NULL OR t."KabupatenID" = $2)
    AND ($3::int IS NULL OR t."KecamatanID" = $3)
    AND ($4::int IS NULL OR t."KelurahanID" = $4)
    AND ${SQL_TPK_SEARCH_PREDICATE}
  ORDER BY
    t."TPKID",
    t."LastModified" DESC NULLS LAST,
    t."NomorRegister" ASC NULLS LAST
) u
ORDER BY
  u.namatpk ASC NULLS LAST,
  u.tpkid ASC
LIMIT $7 OFFSET $8
`;

/**
 * Light ID list untuk sort metrik / relevansi di app (bukan scan by_name).
 * DISTINCT ON TPKID — jangan pernah JOIN PKB/rekap di sini.
 */
export const SQL_TPK_IDS = `
SELECT DISTINCT ON (t."TPKID")
  t."TPKID" AS tpkid,
  t."KelurahanID" AS kelurahanid,
  t."NamaTPK" AS namatpk,
  t."NomorRegister" AS nomorregister
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND ($1::int IS NULL OR t."ProvinsiID" = $1)
  AND ($2::int IS NULL OR t."KabupatenID" = $2)
  AND ($3::int IS NULL OR t."KecamatanID" = $3)
  AND ($4::int IS NULL OR t."KelurahanID" = $4)
  AND ${SQL_TPK_SEARCH_PREDICATE}
ORDER BY
  t."TPKID",
  t."LastModified" DESC NULLS LAST,
  t."NomorRegister" ASC NULLS LAST
`;

/** Cari id_kelurahan by nama dalam scope halaman (host wilayah). */
export const SQL_KELURAHAN_BY_NAMA = `
SELECT
  k."id_kelurahan" AS id_kelurahan,
  k."nama_kelurahan" AS nama_kelurahan
FROM "pk2025"."v_kelurahan" k
WHERE ($1::int IS NULL OR k."id_provinsi" = $1)
  AND ($2::int IS NULL OR k."id_kabupaten" = $2)
  AND ($3::int IS NULL OR k."id_kecamatan" = $3)
  AND ($4::int IS NULL OR k."id_kelurahan" = $4)
  AND k."nama_kelurahan" ILIKE '%' || $5 || '%'
LIMIT 1000
`;

export const SQL_TPK_BY_IDS = `
SELECT DISTINCT ON (t."TPKID")
  t."TPKID" AS tpkid,
  t."NamaTPK" AS namatpk,
  t."NomorRegister" AS nomorregister,
  t."KodeTPK" AS kodetpk,
  t."Alamat" AS alamat,
  t."ProvinsiID" AS provinsiid,
  t."KabupatenID" AS kabupatenid,
  t."KecamatanID" AS kecamatanid,
  t."KelurahanID" AS kelurahanid,
  t."Status" AS status,
  (
    SELECT COUNT(*)::int
    FROM "sigabaru"."dat_AnggotaTPK" a
    WHERE a."TPKID" = t."TPKID"
  ) AS jumlah_anggota
FROM "sigabaru"."dat_TPK" t
WHERE t."TPKID" = ANY($1::text[])
ORDER BY
  t."TPKID",
  t."LastModified" DESC NULLS LAST,
  t."NomorRegister" ASC NULLS LAST
`;

/**
 * Rollup by_rekap → kelurahan (SUM grain RT).
 * Filter provinsi dan/atau kabupaten — jangan full nasional.
 * RTLH tidak ada di DWH.
 */
export const SQL_KELURAHAN_REKAP = `
SELECT
  r."id_kelurahan" AS id_kelurahan,
  COALESCE(SUM(r."jumlah_keluarga_sasaran"), 0) AS keluarga_sasaran,
  COALESCE(SUM(r."total_prioritas"), 0) AS krs,
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
GROUP BY r."id_kelurahan"
`;

/**
 * Satu PKB aktif per desa: DISTINCT ON KelurahanID, urut TRIM(PKBID) ASC.
 * (Jika multi-PKB binaan Status=1 → pilih PKBID terkecil secara konsisten.)
 */
export const SQL_PKB_BY_KELURAHAN = `
SELECT DISTINCT ON (b."KelurahanID")
  b."KelurahanID" AS kelurahanid,
  TRIM(BOTH FROM p."PKBID") AS pkbid,
  p."NamaPetugas" AS nama,
  NULLIF(TRIM(BOTH FROM p."NIK"), '') AS nik,
  NULLIF(TRIM(BOTH FROM p."NoHP"), '') AS nohp,
  p."JabatanPKBAtauPLKBID" AS jabatan_tipe,
  NULLIF(TRIM(BOTH FROM COALESCE(p."JabatanPKBID"::text, '')), '') AS jabatan_pkb,
  NULLIF(TRIM(BOTH FROM COALESCE(p."JabatanBPLKBID"::text, '')), '') AS jabatan_plkb
FROM "sigabaru"."dat_KelurahanDesaBinaan" b
INNER JOIN "sigabaru"."dat_PKB" p
  ON TRIM(BOTH FROM p."PKBID") = TRIM(BOTH FROM b."PKBID")
WHERE b."Status" = 1
  AND p."Status" = 1
  AND b."KelurahanID" = ANY($1::int[])
ORDER BY b."KelurahanID", TRIM(BOTH FROM p."PKBID") ASC
`;

/**
 * Anggota per TPK — prefer StatusTPK 1/2/3 (Bidan / PKK / Kader KB).
 * Fetch terpisah (bukan JOIN di page) agar tidak fan-out baris TPK.
 */
export const SQL_ANGGOTA_BY_TPK = `
SELECT
  a."TPKID" AS tpkid,
  NULLIF(TRIM(BOTH FROM a."Nama"), '') AS nama,
  a."StatusTPK" AS status_tpk,
  a."NomorUrut" AS nomor_urut
FROM "sigabaru"."dat_AnggotaTPK" a
WHERE a."TPKID" = ANY($1::text[])
ORDER BY
  a."TPKID",
  CASE
    WHEN a."StatusTPK" = 1 THEN 1
    WHEN a."StatusTPK" = 2 THEN 2
    WHEN a."StatusTPK" = 3 THEN 3
    ELSE 9
  END,
  a."NomorUrut" ASC NULLS LAST
`;

/**
 * COUNT DISTINCT TPK se-kelurahan dalam filter scope (bukan full nasional).
 * Dipakai caption agregat desa — grain metrik = kelurahan.
 * $7 = id_kelurahan pada halaman saat ini (bukan hasil cari nama).
 */
export const SQL_TPK_COUNT_BY_KELURAHAN = `
SELECT
  t."KelurahanID" AS kelurahanid,
  COUNT(DISTINCT t."TPKID")::int AS n
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND ($1::int IS NULL OR t."ProvinsiID" = $1)
  AND ($2::int IS NULL OR t."KabupatenID" = $2)
  AND ($3::int IS NULL OR t."KecamatanID" = $3)
  AND ($4::int IS NULL OR t."KelurahanID" = $4)
  AND ${SQL_TPK_SEARCH_PREDICATE}
  AND t."KelurahanID" = ANY($7::int[])
GROUP BY t."KelurahanID"
`;

function emptyIndikator(): TpkListIndikator {
  return {
    bumil: null,
    baduta: null,
    balita: null,
    jambanTL: null,
    airTL: null,
    rtlh: null,
  };
}

function indikatorFromRekap(rekap: KelurahanRekap | undefined): {
  keluargaSasaran: number | null;
  krs: number | null;
  indikator: TpkListIndikator;
} {
  if (!rekap) {
    return {
      keluargaSasaran: null,
      krs: null,
      indikator: emptyIndikator(),
    };
  }
  return {
    keluargaSasaran: rekap.keluargaSasaran,
    krs: rekap.krs,
    indikator: {
      bumil: rekap.bumil,
      baduta: rekap.baduta,
      balita: rekap.balita,
      jambanTL: rekap.jambanTL,
      airTL: rekap.airTL,
      rtlh: null,
    },
  };
}

function mapJabatan(
  tipe: number | null,
  jabatanPkb: string | null,
  jabatanPlkb: string | null,
): Pick<TpkListPkb, "jabatan" | "jabatanDetail"> {
  if (tipe === 1) {
    return { jabatan: "PKB", jabatanDetail: jabatanPkb };
  }
  if (tipe === 2) {
    return { jabatan: "PLKB", jabatanDetail: jabatanPlkb };
  }
  return { jabatan: null, jabatanDetail: jabatanPkb ?? jabatanPlkb };
}

function mapPkbRow(row: PkbJoinRow): TpkListPkb {
  const { jabatan, jabatanDetail } = mapJabatan(
    row.jabatan_tipe != null ? toInt(row.jabatan_tipe) : null,
    row.jabatan_pkb,
    row.jabatan_plkb,
  );
  const pkbId = row.pkbid?.trim() || "";
  return {
    pkbId,
    // SIGA PKBID = identitas pegawai; dipakai sebagai NIP match portal.
    nip: pkbId || null,
    nama: row.nama?.trim() || null,
    jabatan,
    jabatanDetail,
    nik: row.nik?.trim() || null,
    noHp: row.nohp?.trim() || null,
  };
}

function needsMetricSort(sort: TpkListSort): boolean {
  return sort !== "nama";
}

/**
 * Resolve id_kelurahan yang nama desanya cocok dengan q, tetap dalam scope halaman.
 * Host terpisah (wilayah) — tidak join lintas-pool ke SIGA.
 */
export async function resolveKelurahanIdsForSearch(
  q: string,
  scope: Pick<
    TpkListQuery,
    "provinsiId" | "kabupatenId" | "kecamatanId" | "kelurahanId"
  >,
): Promise<KelurahanSearchMatch> {
  const empty: KelurahanSearchMatch = { allIds: [], prefixIds: new Set() };
  const needle = q.trim();
  if (!needle || !getPoolConfigs().wilayah.ready) return empty;

  try {
    const res = await queryPool<KelurahanNamaRow>(
      "wilayah",
      SQL_KELURAHAN_BY_NAMA,
      [
        scope.provinsiId,
        scope.kabupatenId,
        scope.kecamatanId,
        scope.kelurahanId,
        needle,
      ],
    );
    const allIds: number[] = [];
    const prefixIds = new Set<number>();
    const needleLower = needle.toLowerCase();
    for (const row of res.rows) {
      const id = toInt(row.id_kelurahan);
      if (id <= 0) continue;
      allIds.push(id);
      const nama = row.nama_kelurahan?.trim().toLowerCase() ?? "";
      if (nama.startsWith(needleLower)) prefixIds.add(id);
    }
    return { allIds, prefixIds };
  } catch (err) {
    console.warn("[tpk-list] resolve kelurahan by nama gagal", err);
    return empty;
  }
}

/**
 * Relevansi cari: 0 exact NomorRegister → 1 prefix desa → 2 partial.
 * Dipakai saat `q` aktif (typeahead + list filter).
 */
export function tpkSearchRelevanceRank(
  row: {
    nomorregister?: string | null;
    kelurahanid?: number | null;
    namatpk?: string | null;
    namaKelurahan?: string | null;
  },
  q: string,
  prefixKelIds: Set<number>,
): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 2;
  const reg = row.nomorregister?.trim().toLowerCase() ?? "";
  if (reg && reg === needle) return 0;
  const kelId = row.kelurahanid != null ? toInt(row.kelurahanid) : null;
  if (kelId != null && prefixKelIds.has(kelId)) return 1;
  const desa = row.namaKelurahan?.trim().toLowerCase() ?? "";
  if (desa.startsWith(needle)) return 1;
  const namaTpk = row.namatpk?.trim().toLowerCase() ?? "";
  if (namaTpk.startsWith(needle) || namaTpk.startsWith(`tpk (${needle}`)) {
    return 1;
  }
  return 2;
}

function sortMetric(
  rekap: KelurahanRekap | undefined,
  sort: TpkListSort,
): number {
  if (!rekap) return -1;
  switch (sort) {
    case "krs-desc":
    case "krs-asc":
      return rekap.krs;
    case "ibuHamil-desc":
      return rekap.bumil;
    case "baduta-desc":
      return rekap.baduta;
    case "balita-desc":
      return rekap.balita;
    case "rtlh-desc":
      return -1; // selalu null
    default:
      return -1;
  }
}

/**
 * Rollup kelurahan dari by_rekap — cache 60 dtk per scope wilayah.
 * Tidak pernah scan by_name.
 */
export async function getKelurahanRekapMap(
  provinsiId: number | null,
  kabupatenId: number | null,
  kecamatanId: number | null = null,
  kelurahanId: number | null = null,
): Promise<Map<number, KelurahanRekap>> {
  const empty = new Map<number, KelurahanRekap>();
  if (!getPoolConfigs().dwh.ready) return empty;
  if (
    provinsiId == null &&
    kabupatenId == null &&
    kecamatanId == null &&
    kelurahanId == null
  ) {
    return empty;
  }

  const periode = getDwhPeriode();
  const key = cacheKey([
    "kelurahan-rekap",
    provinsiId ?? "",
    kabupatenId ?? "",
    kecamatanId ?? "",
    kelurahanId ?? "",
    periode,
  ]);
  const hit = getCached<Map<number, KelurahanRekap>>(key);
  if (hit) return hit;

  try {
    const res = await queryPool<KelurahanRekapRow>("dwh", SQL_KELURAHAN_REKAP, [
      provinsiId,
      kabupatenId,
      kecamatanId,
      kelurahanId,
      periode,
    ]);
    const map = new Map<number, KelurahanRekap>();
    for (const row of res.rows) {
      map.set(toInt(row.id_kelurahan), {
        keluargaSasaran: toInt(row.keluarga_sasaran),
        krs: toInt(row.krs),
        bumil: toInt(row.bumil),
        baduta: toInt(row.baduta),
        balita: toInt(row.balita),
        jambanTL: toInt(row.jamban_tl),
        airTL: toInt(row.air_tl),
      });
    }
    return setCached(key, map, DEFAULT_CACHE_TTL_SEC);
  } catch (err) {
    console.warn("[tpk-list] kelurahan rekap gagal, indikator = null", err);
    return empty;
  }
}

async function fetchPkbByKelurahan(
  kelIds: number[],
): Promise<Map<number, TpkListPkb>> {
  const map = new Map<number, TpkListPkb>();
  if (kelIds.length === 0 || !getPoolConfigs().siga.ready) return map;
  try {
    const res = await queryPool<PkbJoinRow>("siga", SQL_PKB_BY_KELURAHAN, [
      kelIds,
    ]);
    for (const row of res.rows) {
      map.set(toInt(row.kelurahanid), mapPkbRow(row));
    }
  } catch (err) {
    console.warn("[tpk-list] PKB join gagal, pkb = null", err);
  }
  return map;
}

/** Maks 3 nama per TPK; urutan StatusTPK 1→2→3 lalu NomorUrut. */
export function pickAnggotaNames(rows: readonly AnggotaRow[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const nama = row.nama?.trim();
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(nama);
    if (names.length >= 3) break;
  }
  return names;
}

async function fetchAnggotaByTpkIds(
  tpkIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (tpkIds.length === 0 || !getPoolConfigs().siga.ready) return map;
  try {
    const res = await queryPool<AnggotaRow>("siga", SQL_ANGGOTA_BY_TPK, [
      tpkIds,
    ]);
    const byTpk = new Map<string, AnggotaRow[]>();
    for (const row of res.rows) {
      const id = row.tpkid?.trim();
      if (!id) continue;
      const list = byTpk.get(id) ?? [];
      list.push(row);
      byTpk.set(id, list);
    }
    for (const [id, rows] of byTpk) {
      map.set(id, pickAnggotaNames(rows));
    }
  } catch (err) {
    console.warn("[tpk-list] anggota fetch gagal, anggota = []", err);
  }
  return map;
}

async function fetchTpkCountByKelurahan(
  query: TpkListQuery,
  q: string | null,
  kelSearchIds: number[],
  kelIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (kelIds.length === 0 || !getPoolConfigs().siga.ready) return map;
  try {
    const res = await queryPool<TpkSeDesaRow>(
      "siga",
      SQL_TPK_COUNT_BY_KELURAHAN,
      [
        query.provinsiId,
        query.kabupatenId,
        query.kecamatanId,
        query.kelurahanId,
        q,
        kelSearchIds,
        kelIds,
      ],
    );
    for (const row of res.rows) {
      map.set(toInt(row.kelurahanid), toInt(row.n));
    }
  } catch (err) {
    console.warn("[tpk-list] tpkSeDesa count gagal, default 1", err);
  }
  return map;
}

async function lookupWilayahNames(rows: SigaTpkRow[]): Promise<{
  namaKab: Map<number, string>;
  namaKec: Map<number, string>;
  namaKel: Map<number, string>;
}> {
  const namaKab = new Map<number, string>();
  const namaKec = new Map<number, string>();
  const namaKel = new Map<number, string>();

  if (!getPoolConfigs().wilayah.ready) {
    return { namaKab, namaKec, namaKel };
  }

  const kabIds = new Set<number>();
  const kecIds = new Set<number>();
  const kelIds = new Set<number>();
  for (const row of rows) {
    if (row.kabupatenid != null) kabIds.add(toInt(row.kabupatenid));
    if (row.kecamatanid != null) kecIds.add(toInt(row.kecamatanid));
    if (row.kelurahanid != null) kelIds.add(toInt(row.kelurahanid));
  }

  const lookups: Promise<void>[] = [];
  if (kabIds.size > 0) {
    lookups.push(
      queryPool<NamaKabRow>(
        "wilayah",
        `SELECT k."id_kabupaten", k."nama_kabupaten"
         FROM "pk2025"."v_kabupaten" k
         WHERE k."id_kabupaten" = ANY($1::int[])`,
        [Array.from(kabIds)],
      ).then((res) => {
        for (const row of res.rows) {
          namaKab.set(toInt(row.id_kabupaten), row.nama_kabupaten?.trim() ?? "");
        }
      }),
    );
  }
  if (kecIds.size > 0) {
    lookups.push(
      queryPool<NamaKecRow>(
        "wilayah",
        `SELECT k."id_kecamatan", k."nama_kecamatan"
         FROM "pk2025"."v_kecamatan" k
         WHERE k."id_kecamatan" = ANY($1::int[])`,
        [Array.from(kecIds)],
      ).then((res) => {
        for (const row of res.rows) {
          namaKec.set(toInt(row.id_kecamatan), row.nama_kecamatan?.trim() ?? "");
        }
      }),
    );
  }
  if (kelIds.size > 0) {
    lookups.push(
      queryPool<NamaKelRow>(
        "wilayah",
        `SELECT k."id_kelurahan", k."nama_kelurahan"
         FROM "pk2025"."v_kelurahan" k
         WHERE k."id_kelurahan" = ANY($1::int[])`,
        [Array.from(kelIds)],
      ).then((res) => {
        for (const row of res.rows) {
          namaKel.set(toInt(row.id_kelurahan), row.nama_kelurahan?.trim() ?? "");
        }
      }),
    );
  }

  try {
    await Promise.all(lookups);
  } catch (err) {
    console.warn("[tpk-list] wilayah lookup gagal, lanjut tanpa nama", err);
  }

  return { namaKab, namaKec, namaKel };
}

function buildItem(
  row: SigaTpkRow,
  names: {
    namaKab: Map<number, string>;
    namaKec: Map<number, string>;
    namaKel: Map<number, string>;
  },
  rekapMap: Map<number, KelurahanRekap>,
  pkbMap: Map<number, TpkListPkb>,
  anggotaMap: Map<string, string[]>,
  tpkSeDesaMap: Map<number, number>,
): TpkListItem {
  const kabId = row.kabupatenid != null ? toInt(row.kabupatenid) : null;
  const kecId = row.kecamatanid != null ? toInt(row.kecamatanid) : null;
  const kelId = row.kelurahanid != null ? toInt(row.kelurahanid) : null;
  const namaKelurahan =
    kelId != null ? names.namaKel.get(kelId)?.trim() || null : null;
  const nama = namaKelurahan
    ? `TPK (${namaKelurahan})`
    : row.nomorregister?.trim()
      ? `TPK (reg ${row.nomorregister.trim()})`
      : row.namatpk?.trim() || null;

  const rekap = kelId != null ? rekapMap.get(kelId) : undefined;
  const metrics = indikatorFromRekap(rekap);
  const pkb = kelId != null ? pkbMap.get(kelId) ?? null : null;
  const anggota = anggotaMap.get(row.tpkid) ?? [];
  const tpkSeDesa =
    kelId != null ? (tpkSeDesaMap.get(kelId) ?? 1) : 1;

  return {
    tpkId: row.tpkid,
    nama,
    nomorRegister: row.nomorregister?.trim() || null,
    kodeTpk: row.kodetpk?.trim() || null,
    alamat: row.alamat?.trim() || null,
    provinsiId: row.provinsiid != null ? toInt(row.provinsiid) : null,
    kabupatenId: kabId,
    kecamatanId: kecId,
    kelurahanId: kelId,
    namaKabupaten: kabId != null ? names.namaKab.get(kabId) || null : null,
    namaKecamatan: kecId != null ? names.namaKec.get(kecId) || null : null,
    namaKelurahan,
    jumlahAnggota: toInt(row.jumlah_anggota),
    anggota,
    tpkSeDesa,
    status: row.status != null ? toInt(row.status) : null,
    ...metrics,
    pkb,
  };
}

async function enrichPageRows(
  rows: SigaTpkRow[],
  query: TpkListQuery,
  kelSearchIds: number[] = [],
): Promise<TpkListItem[]> {
  if (rows.length === 0) return [];

  const kelIds = Array.from(
    new Set(
      rows
        .map((r) => (r.kelurahanid != null ? toInt(r.kelurahanid) : null))
        .filter((id): id is number => id != null && id > 0),
    ),
  );
  const tpkIds = rows.map((r) => r.tpkid);
  const q = query.q?.trim() ? query.q.trim() : null;

  const [names, rekapMap, pkbMap, anggotaMap, tpkSeDesaMap] =
    await Promise.all([
      lookupWilayahNames(rows),
      getKelurahanRekapMap(
        query.provinsiId,
        query.kabupatenId,
        query.kecamatanId,
        query.kelurahanId,
      ),
      fetchPkbByKelurahan(kelIds),
      fetchAnggotaByTpkIds(tpkIds),
      fetchTpkCountByKelurahan(query, q, kelSearchIds, kelIds),
    ]);

  return rows.map((row) =>
    buildItem(row, names, rekapMap, pkbMap, anggotaMap, tpkSeDesaMap),
  );
}

function dedupeSigaRows<T extends { tpkid: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = row.tpkid?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

async function fetchPageByNama(
  query: TpkListQuery,
  q: string | null,
  kelSearchIds: number[],
  offset: number,
): Promise<SigaTpkRow[]> {
  const pageRes = await queryPool<SigaTpkRow>("siga", SQL_TPK_PAGE, [
    query.provinsiId,
    query.kabupatenId,
    query.kecamatanId,
    query.kelurahanId,
    q,
    kelSearchIds,
    query.pageSize,
    offset,
  ]);
  return dedupeSigaRows(pageRes.rows);
}

/**
 * Sort metrik dan/atau relevansi cari: ID ringan SIGA + rollup cache, urut di app.
 * Hindari join lintas-host di SQL dan hindari by_name.
 */
async function fetchPageByRankedIds(
  query: TpkListQuery,
  q: string | null,
  kelSearch: KelurahanSearchMatch,
): Promise<SigaTpkRow[]> {
  const [idsRes, rekapMap] = await Promise.all([
    queryPool<SigaIdRow>("siga", SQL_TPK_IDS, [
      query.provinsiId,
      query.kabupatenId,
      query.kecamatanId,
      query.kelurahanId,
      q,
      kelSearch.allIds,
    ]),
    getKelurahanRekapMap(
      query.provinsiId,
      query.kabupatenId,
      query.kecamatanId,
      query.kelurahanId,
    ),
  ]);

  const asc = query.sort === "krs-asc";
  const uniqueIds: SigaIdRow[] = dedupeSigaRows(idsRes.rows);
  const useRelevance = Boolean(q);

  const ranked = uniqueIds.slice().sort((a, b) => {
    if (useRelevance && q) {
      const ra = tpkSearchRelevanceRank(a, q, kelSearch.prefixIds);
      const rb = tpkSearchRelevanceRank(b, q, kelSearch.prefixIds);
      if (ra !== rb) return ra - rb;
    }

    if (needsMetricSort(query.sort)) {
      const kelA = a.kelurahanid != null ? toInt(a.kelurahanid) : null;
      const kelB = b.kelurahanid != null ? toInt(b.kelurahanid) : null;
      const va = sortMetric(
        kelA != null ? rekapMap.get(kelA) : undefined,
        query.sort,
      );
      const vb = sortMetric(
        kelB != null ? rekapMap.get(kelB) : undefined,
        query.sort,
      );
      if (va !== vb) return asc ? va - vb : vb - va;
    }

    const nameCmp = (a.namatpk ?? "").localeCompare(b.namatpk ?? "", "id");
    if (nameCmp !== 0) return nameCmp;
    return a.tpkid.localeCompare(b.tpkid);
  });

  const offset = (query.page - 1) * query.pageSize;
  const pageIds = ranked
    .slice(offset, offset + query.pageSize)
    .map((r) => r.tpkid);
  if (pageIds.length === 0) return [];

  const pageRes = await queryPool<SigaTpkRow>("siga", SQL_TPK_BY_IDS, [
    pageIds,
  ]);
  const byId = new Map(dedupeSigaRows(pageRes.rows).map((r) => [r.tpkid, r]));
  return pageIds
    .map((id) => byId.get(id))
    .filter((r): r is SigaTpkRow => r != null);
}

export async function getTpkListPostgres(
  query: TpkListQuery,
): Promise<TpkListPayload> {
  if (!isSigaConfigured()) {
    return getTpkListMock(query);
  }

  if (
    query.provinsiId == null &&
    query.kabupatenId == null &&
    query.kecamatanId == null &&
    query.kelurahanId == null
  ) {
    throw new PostgresDataError(
      "missing_wilayah_filter",
      "Daftar TPK membutuhkan filter wilayah (hindari full scan).",
      { status: 400 },
    );
  }

  const q = query.q?.trim() ? query.q.trim() : null;
  const offset = (query.page - 1) * query.pageSize;
  const kelSearch = q
    ? await resolveKelurahanIdsForSearch(q, query)
    : { allIds: [] as number[], prefixIds: new Set<number>() };

  const countRes = await queryPool<CountRow>("siga", SQL_TPK_COUNT, [
    query.provinsiId,
    query.kabupatenId,
    query.kecamatanId,
    query.kelurahanId,
    q,
    kelSearch.allIds,
  ]);
  const total = toInt(countRes.rows[0]?.total);
  const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;

  let pageRows: SigaTpkRow[];
  // Dengan q: ranking relevansi (+ metrik sekunder). Tanpa q + sort nama: SQL page.
  if (q || needsMetricSort(query.sort)) {
    pageRows = await fetchPageByRankedIds(query, q, kelSearch);
  } else {
    pageRows = await fetchPageByNama(query, q, kelSearch.allIds, offset);
  }

  let items: TpkListItem[];
  try {
    items = await enrichPageRows(pageRows, query, kelSearch.allIds);
  } catch (err) {
    console.warn("[tpk-list] enrich gagal, kembalikan baris dasar", err);
    items = pageRows.map((row) => {
      const base = buildItem(
        row,
        {
          namaKab: new Map(),
          namaKec: new Map(),
          namaKel: new Map(),
        },
        new Map(),
        new Map(),
        new Map(),
        new Map(),
      );
      return { ...base, ...blankIndikatorFields() };
    });
  }
  items = dedupeByTpkId(items);

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      provinsiId: query.provinsiId,
      kabupatenId: query.kabupatenId,
      kecamatanId: query.kecamatanId,
      kelurahanId: query.kelurahanId,
      q,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
