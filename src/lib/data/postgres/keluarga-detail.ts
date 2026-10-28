import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import {
  mapStuntingHeadRow,
  type StuntingHeadRowRow,
} from "@/lib/data/keluarga-detail-map";
import {
  compactKki,
  paddedKkiForms,
  primaryPaddedKki,
} from "@/lib/data/kki";
import {
  logPostgresError,
  PostgresDataError,
  redactDatabaseUrl,
} from "@/lib/data/postgres/errors";
import { getPool, getPoolConfigs } from "@/lib/data/postgres/pools";
import type {
  KeluargaDetailPayload,
  KeluargaDetailQuery,
} from "@/lib/data/types";
import type { QueryResult } from "pg";

const DETAIL_SELECT = `
  src."id_stunting",
  src."kki",
  src."id_provinsi",
  src."id_kelurahan",
  src."no_kk",
  src."nama_kk",
  src."nama_istri",
  src."alamat",
  src."latitude",
  src."longitude",
  src."kesejahteraan_prioritas",
  src."resiko_stunting",
  src."jns_atap",
  src."kondisi_atap",
  src."jns_dinding",
  src."kondisi_dinding",
  src."jns_lantai",
  src."kondisi_lantai",
  src."sumber_air_minum",
  src."kondisi_sumber_air_minum",
  src."memiliki_tempat_bab",
  src."kondisi_fasilitas_bab",
  src."foto_rumah",
  src."foto_jamban",
  src."luas_rumah",
  src."jml_orang_tinggal",
  src."keterangan"
`;

/**
 * Partisi LIST by id_provinsi → `stunting_head_01` … (pad 2 digit).
 * Dump: 01–33, 36–40 (34/35 tidak ada).
 */
const KNOWN_STUNTING_HEAD_PARTITIONS = new Set<number>([
  ...Array.from({ length: 33 }, (_, i) => i + 1),
  36, 37, 38, 39, 40,
]);

/**
 * Nama tabel partisi aman (identifier dari int, bukan string user).
 * Contoh Fajar: `stunting_head_01` untuk provinsi 1.
 */
export function stuntingHeadPartitionRelation(provinsiId: number): {
  schema: "verval2024_monitoring";
  table: string;
  qualified: string;
} {
  if (!Number.isInteger(provinsiId) || provinsiId < 1 || provinsiId > 99) {
    throw new PostgresDataError(
      "invalid_provinsi_id",
      "provinsiId tidak valid untuk partisi stunting_head.",
      { pool: "verval", status: 400 },
    );
  }
  if (!KNOWN_STUNTING_HEAD_PARTITIONS.has(provinsiId)) {
    throw new PostgresDataError(
      "partition_not_found",
      `Partisi stunting_head_${String(provinsiId).padStart(2, "0")} tidak ada di dump (id_provinsi=${provinsiId}).`,
      { pool: "verval", status: 404 },
    );
  }
  const table = `stunting_head_${String(provinsiId).padStart(2, "0")}`;
  return {
    schema: "verval2024_monitoring",
    table,
    qualified: `"verval2024_monitoring"."${table}"`,
  };
}

/** Equality KKI pada tabel partisi — pola Fajar. */
function sqlExactOnPartition(qualified: string): string {
  return `
SELECT ${DETAIL_SELECT}
FROM ${qualified} src
WHERE src."kki" = $1
LIMIT 1
`;
}

/** Fallback compact hanya di tabel partisi yang sama. */
function sqlCompactOnPartition(qualified: string): string {
  return `
SELECT ${DETAIL_SELECT}
FROM ${qualified} src
WHERE replace(src."kki", ' ', '') = $1
LIMIT 1
`;
}

async function queryVervalDetail<T extends StuntingHeadRowRow>(
  text: string,
  params: unknown[],
): Promise<QueryResult<T>> {
  const config = getPoolConfigs().verval;
  const pool = getPool("verval");
  try {
    return await pool.query<T>({
      text,
      values: params,
      query_timeout: 8_000,
    });
  } catch (err) {
    logPostgresError("query failed (verval detail)", err, {
      pool: "verval",
      url: config.url,
    });
    const hint = config.url ? redactDatabaseUrl(config.url) : config.envKey;
    const missingTable =
      err instanceof Error &&
      /relation .* does not exist|undefined_table/i.test(err.message);
    if (missingTable) {
      throw new PostgresDataError(
        "partition_not_found",
        `Tabel partisi stunting_head tidak ditemukan (${hint}).`,
        { pool: "verval", cause: err, status: 404 },
      );
    }
    const timedOut =
      err instanceof Error &&
      /timeout|canceling statement/i.test(err.message);
    throw new PostgresDataError(
      timedOut ? "postgres_query_timeout" : "postgres_query_failed",
      timedOut
        ? `Query verval timeout (${hint}). Pakai tabel partisi + equality KKI padded.`
        : `Query verval gagal (${hint}). Periksa koneksi/SQL — lihat log server.`,
      { pool: "verval", cause: err, status: 503 },
    );
  }
}

/**
 * Baca 1 keluarga dari **tabel partisi**
 * `"verval2024_monitoring"."stunting_head_{NN}"` (NN = provinsiId pad 2).
 *
 * Contoh Fajar:
 * `SELECT * FROM stunting_head_01 WHERE kki = '11061020310200      001019026'`
 *
 * Equality padded dulu; compact hanya fallback. Bukan parent + regexp.
 */
export async function getKeluargaDetailPostgres(
  query: KeluargaDetailQuery,
): Promise<KeluargaDetailPayload> {
  const compact = compactKki(query.kki);
  if (!compact) {
    throw new PostgresDataError(
      "invalid_kki",
      "Parameter kki wajib diisi.",
      { pool: "verval", status: 400 },
    );
  }

  if (query.provinsiId == null || !Number.isFinite(query.provinsiId)) {
    throw new PostgresDataError(
      "invalid_provinsi_id",
      "Parameter provinsiId wajib — memilih tabel partisi stunting_head_{NN}.",
      { pool: "verval", status: 400 },
    );
  }

  const { qualified } = stuntingHeadPartitionRelation(
    Math.trunc(query.provinsiId),
  );

  const paddedPrimary = primaryPaddedKki(query.kki);
  const paddedForms = paddedKkiForms(query.kki);

  let row: StuntingHeadRowRow | undefined;

  // 1) Equality ke bentuk padded utama (14 + 6 spasi + sisa) — seperti contoh Fajar
  if (paddedPrimary) {
    const res = await queryVervalDetail<StuntingHeadRowRow>(
      sqlExactOnPartition(qualified),
      [paddedPrimary],
    );
    row = res.rows[0];
  }

  // 2) Bentuk padded alternatif (1 spasi) bila beda
  if (!row) {
    for (const form of paddedForms) {
      if (form === paddedPrimary) continue;
      const res = await queryVervalDetail<StuntingHeadRowRow>(
        sqlExactOnPartition(qualified),
        [form],
      );
      row = res.rows[0];
      if (row) break;
    }
  }

  // 3) Fallback compact hanya di partisi yang sama
  if (!row) {
    const res = await queryVervalDetail<StuntingHeadRowRow>(
      sqlCompactOnPartition(qualified),
      [compact],
    );
    row = res.rows[0];
  }

  if (!row) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Detail keluarga tidak ditemukan untuk KKI ${compact} di ${qualified}.`,
      { pool: "verval", status: 404 },
    );
  }

  const item = mapStuntingHeadRow(row);
  if (!item) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Baris stunting_head tidak valid untuk KKI ${compact}.`,
      { pool: "verval", status: 404 },
    );
  }

  return {
    item,
    join: {
      key: "kki",
      pinField: "kki",
      headField: "kki",
      byNameColumn: "kode_keluarga",
    },
    meta: {
      source: "postgres",
      generatedAt: new Date().toISOString(),
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
    },
  };
}
