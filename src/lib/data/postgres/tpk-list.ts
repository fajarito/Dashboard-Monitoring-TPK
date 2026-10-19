import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getTpkListMock } from "@/lib/data/mock/tpk-list";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  getPoolConfigs,
  queryPool,
} from "@/lib/data/postgres/pools";
import type { TpkListItem, TpkListPayload, TpkListQuery } from "@/lib/data/types";

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

type NamaKabRow = { id_kabupaten: number; nama_kabupaten: string };
type NamaKecRow = { id_kecamatan: number; nama_kecamatan: string };
type NamaKelRow = { id_kelurahan: number; nama_kelurahan: string };

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** SIGA saja cukup untuk list; wilayah opsional untuk nama. */
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
 * (hindari GROUP BY seluruh tabel).
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

  const [countRes, pageRes] = await Promise.all([
    queryPool<CountRow>("siga", SQL_TPK_COUNT, [
      query.provinsiId,
      query.kabupatenId,
      q,
    ]),
    queryPool<SigaTpkRow>("siga", SQL_TPK_PAGE, [
      query.provinsiId,
      query.kabupatenId,
      q,
      query.pageSize,
      offset,
    ]),
  ]);

  const total = toInt(countRes.rows[0]?.total);
  const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;

  const kabIds = new Set<number>();
  const kecIds = new Set<number>();
  const kelIds = new Set<number>();
  for (const row of pageRes.rows) {
    if (row.kabupatenid != null) kabIds.add(toInt(row.kabupatenid));
    if (row.kecamatanid != null) kecIds.add(toInt(row.kecamatanid));
    if (row.kelurahanid != null) kelIds.add(toInt(row.kelurahanid));
  }

  const namaKab = new Map<number, string>();
  const namaKec = new Map<number, string>();
  const namaKel = new Map<number, string>();

  if (getPoolConfigs().wilayah.ready) {
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
    // Nama wilayah gagal → tetap kembalikan list SIGA (tanpa blank page).
    try {
      await Promise.all(lookups);
    } catch (err) {
      console.warn("[tpk-list] wilayah lookup gagal, lanjut tanpa nama", err);
    }
  }

  const items: TpkListItem[] = pageRes.rows.map((row: SigaTpkRow) => {
    const kabId = row.kabupatenid != null ? toInt(row.kabupatenid) : null;
    const kecId = row.kecamatanid != null ? toInt(row.kecamatanid) : null;
    const kelId = row.kelurahanid != null ? toInt(row.kelurahanid) : null;
    const namaKelurahan =
      kelId != null ? namaKel.get(kelId)?.trim() || null : null;
    // Preferensi tampilan: TPK (nama desa/kelurahan) dari v_kelurahan.
    const nama = namaKelurahan
      ? `TPK (${namaKelurahan})`
      : row.nomorregister?.trim()
        ? `TPK (reg ${row.nomorregister.trim()})`
        : row.namatpk?.trim() || null;
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
      namaKabupaten: kabId != null ? namaKab.get(kabId) || null : null,
      namaKecamatan: kecId != null ? namaKec.get(kecId) || null : null,
      namaKelurahan,
      jumlahAnggota: toInt(row.jumlah_anggota),
      status: row.status != null ? toInt(row.status) : null,
    };
  });

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
