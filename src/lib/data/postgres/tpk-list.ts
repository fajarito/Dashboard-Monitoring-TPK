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

export const SQL_TPK_COUNT = `
SELECT COUNT(*)::int AS total
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND ($1::int IS NULL OR t."ProvinsiID" = $1)
  AND ($2::int IS NULL OR t."KabupatenID" = $2)
  AND (
    $3::text IS NULL
    OR t."NamaTPK" ILIKE '%' || $3 || '%'
  )
`;

/**
 * Halaman TPK aktif + count anggota hanya untuk baris halaman
 * (hindari GROUP BY seluruh tabel). Urutan nama A–Z.
 */
export const SQL_TPK_PAGE = `
SELECT
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
  AND (
    $3::text IS NULL
    OR t."NamaTPK" ILIKE '%' || $3 || '%'
  )
ORDER BY
  t."NamaTPK" ASC NULLS LAST,
  t."TPKID" ASC
LIMIT $4 OFFSET $5
`;

/** Light ID list untuk sort metrik di app (bukan scan by_name). */
export const SQL_TPK_IDS = `
SELECT
  t."TPKID" AS tpkid,
  t."KelurahanID" AS kelurahanid,
  t."NamaTPK" AS namatpk
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND ($1::int IS NULL OR t."ProvinsiID" = $1)
  AND ($2::int IS NULL OR t."KabupatenID" = $2)
  AND (
    $3::text IS NULL
    OR t."NamaTPK" ILIKE '%' || $3 || '%'
  )
`;

export const SQL_TPK_BY_IDS = `
SELECT
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
WHERE r."periode" = $3
  AND ($1::int IS NULL OR r."id_provinsi" = $1)
  AND ($2::int IS NULL OR r."id_kabupaten" = $2)
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
  return {
    pkbId: row.pkbid,
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
): Promise<Map<number, KelurahanRekap>> {
  const empty = new Map<number, KelurahanRekap>();
  if (!getPoolConfigs().dwh.ready) return empty;
  if (provinsiId == null && kabupatenId == null) return empty;

  const periode = getDwhPeriode();
  const key = cacheKey([
    "kelurahan-rekap",
    provinsiId ?? "",
    kabupatenId ?? "",
    periode,
  ]);
  const hit = getCached<Map<number, KelurahanRekap>>(key);
  if (hit) return hit;

  try {
    const res = await queryPool<KelurahanRekapRow>("dwh", SQL_KELURAHAN_REKAP, [
      provinsiId,
      kabupatenId,
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
    status: row.status != null ? toInt(row.status) : null,
    ...metrics,
    pkb,
  };
}

async function enrichPageRows(
  rows: SigaTpkRow[],
  query: TpkListQuery,
): Promise<TpkListItem[]> {
  if (rows.length === 0) return [];

  const kelIds = Array.from(
    new Set(
      rows
        .map((r) => (r.kelurahanid != null ? toInt(r.kelurahanid) : null))
        .filter((id): id is number => id != null && id > 0),
    ),
  );

  const [names, rekapMap, pkbMap] = await Promise.all([
    lookupWilayahNames(rows),
    getKelurahanRekapMap(query.provinsiId, query.kabupatenId),
    fetchPkbByKelurahan(kelIds),
  ]);

  return rows.map((row) => buildItem(row, names, rekapMap, pkbMap));
}

async function fetchPageByNama(
  query: TpkListQuery,
  q: string | null,
  offset: number,
): Promise<SigaTpkRow[]> {
  const pageRes = await queryPool<SigaTpkRow>("siga", SQL_TPK_PAGE, [
    query.provinsiId,
    query.kabupatenId,
    q,
    query.pageSize,
    offset,
  ]);
  return pageRes.rows;
}

/**
 * Sort metrik: ambil ID ringan SIGA + rollup cache, urut di app, hydrate halaman.
 * Hindari join lintas-host di SQL dan hindari by_name.
 */
async function fetchPageByMetricSort(
  query: TpkListQuery,
  q: string | null,
): Promise<SigaTpkRow[]> {
  const [idsRes, rekapMap] = await Promise.all([
    queryPool<SigaIdRow>("siga", SQL_TPK_IDS, [
      query.provinsiId,
      query.kabupatenId,
      q,
    ]),
    getKelurahanRekapMap(query.provinsiId, query.kabupatenId),
  ]);

  const asc = query.sort === "krs-asc";
  const ranked = idsRes.rows.slice().sort((a, b) => {
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
  const byId = new Map(pageRes.rows.map((r) => [r.tpkid, r]));
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

  if (query.provinsiId == null && query.kabupatenId == null) {
    throw new PostgresDataError(
      "missing_wilayah_filter",
      "Daftar TPK membutuhkan provinsiId dan/atau kabupatenId (hindari full scan).",
      { status: 400 },
    );
  }

  const q = query.q?.trim() ? query.q.trim() : null;
  const offset = (query.page - 1) * query.pageSize;

  const countRes = await queryPool<CountRow>("siga", SQL_TPK_COUNT, [
    query.provinsiId,
    query.kabupatenId,
    q,
  ]);
  const total = toInt(countRes.rows[0]?.total);
  const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;

  let pageRows: SigaTpkRow[];
  if (needsMetricSort(query.sort)) {
    pageRows = await fetchPageByMetricSort(query, q);
  } else {
    pageRows = await fetchPageByNama(query, q, offset);
  }

  let items: TpkListItem[];
  try {
    items = await enrichPageRows(pageRows, query);
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
      );
      return { ...base, ...blankIndikatorFields() };
    });
  }

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      provinsiId: query.provinsiId,
      kabupatenId: query.kabupatenId,
      q,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
