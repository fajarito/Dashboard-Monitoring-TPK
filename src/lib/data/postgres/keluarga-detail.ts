import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import {
  mapStuntingHeadRow,
  type StuntingHeadRowRow,
} from "@/lib/data/keluarga-detail-map";
import { compactKki, kkiMatchCandidates } from "@/lib/data/kki";
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

/** Lookup cepat: prune LIST(id_provinsi) + equality KKI (hindari regexp scan). */
function sqlExactKki(): string {
  return `
SELECT ${DETAIL_SELECT}
FROM "verval2024_monitoring"."stunting_head" src
WHERE src."id_provinsi" = $1
  AND src."kki" = ANY($2::varchar[])
LIMIT 1
`;
}

/** Fallback dalam partisi: compact via replace spasi. */
function sqlCompactFallback(): string {
  return `
SELECT ${DETAIL_SELECT}
FROM "verval2024_monitoring"."stunting_head" src
WHERE src."id_provinsi" = $1
  AND replace(src."kki", ' ', '') = $2
LIMIT 1
`;
}

/**
 * Query khusus detail — timeout lokal di path ini saja (tidak ubah queryPool global).
 */
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
      // Jaring pengaman setelah prune; prefer query cepat via equality.
      query_timeout: 8_000,
    });
  } catch (err) {
    logPostgresError("query failed (verval detail)", err, {
      pool: "verval",
      url: config.url,
    });
    const hint = config.url ? redactDatabaseUrl(config.url) : config.envKey;
    const timedOut =
      err instanceof Error &&
      /timeout|canceling statement/i.test(err.message);
    throw new PostgresDataError(
      timedOut ? "postgres_query_timeout" : "postgres_query_failed",
      timedOut
        ? `Query verval timeout (${hint}). Pastikan id_provinsi + KKI equality; jangan scan parent.`
        : `Query verval gagal (${hint}). Periksa koneksi/SQL — lihat log server.`,
      { pool: "verval", cause: err, status: 503 },
    );
  }
}

/**
 * Baca 1 keluarga dari parent partition `verval2024_monitoring.stunting_head`.
 * Join **by KKI**; wajib `provinsiId` untuk prune partisi (hindari timeout).
 * Pool **verval** — host volt_verval beda dari SIGA.
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
      "Parameter provinsiId wajib untuk lookup live stunting_head (prune partisi LIST).",
      { pool: "verval", status: 400 },
    );
  }

  const candidates = kkiMatchCandidates(query.kki);

  let row: StuntingHeadRowRow | undefined;

  const exact = await queryVervalDetail<StuntingHeadRowRow>(sqlExactKki(), [
    query.provinsiId,
    candidates,
  ]);
  row = exact.rows[0];

  if (!row) {
    const fallback = await queryVervalDetail<StuntingHeadRowRow>(
      sqlCompactFallback(),
      [query.provinsiId, compact],
    );
    row = fallback.rows[0];
  }

  if (!row) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Detail keluarga tidak ditemukan untuk KKI ${compact}.`,
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
