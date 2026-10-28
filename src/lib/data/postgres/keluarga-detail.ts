import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import {
  mapStuntingHeadRow,
  type StuntingHeadRowRow,
} from "@/lib/data/keluarga-detail-map";
import {
  compactKki,
  describeKkiForDiag,
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
 *
 * `id_provinsi` = ID internal SIGA/pk2025 — **bukan** kode BPS/Kemendagri.
 * Contoh: Jabar BPS `32` → id_provinsi `12` → `stunting_head_12`.
 */
const KNOWN_STUNTING_HEAD_PARTITIONS = new Set<number>([
  ...Array.from({ length: 33 }, (_, i) => i + 1),
  36, 37, 38, 39, 40,
]);

export type StuntingHeadPartitionRelation = {
  schema: "verval2024_monitoring";
  table: string;
  qualified: string;
  idProvinsi: number;
  suffix: string;
};

/**
 * Nama tabel partisi aman (identifier dari int, bukan string user).
 * Contoh Fajar: `stunting_head_01` untuk id_provinsi 1 (Aceh; BPS 11).
 */
export function stuntingHeadPartitionRelation(
  provinsiId: number,
): StuntingHeadPartitionRelation {
  if (!Number.isInteger(provinsiId) || provinsiId < 1 || provinsiId > 99) {
    throw new PostgresDataError(
      "invalid_provinsi_id",
      "provinsiId tidak valid untuk partisi stunting_head.",
      { pool: "verval", status: 400 },
    );
  }
  const suffix = String(provinsiId).padStart(2, "0");
  if (!KNOWN_STUNTING_HEAD_PARTITIONS.has(provinsiId)) {
    throw new PostgresDataError(
      "partition_not_found",
      `Partisi stunting_head_${suffix} tidak ada di dump (id_provinsi=${provinsiId}).`,
      { pool: "verval", status: 404 },
    );
  }
  const table = `stunting_head_${suffix}`;
  return {
    schema: "verval2024_monitoring",
    table,
    qualified: `"verval2024_monitoring"."${table}"`,
    idProvinsi: provinsiId,
    suffix,
  };
}

/**
 * Pola Fajar persis — equality scalar, padded primary saja:
 *   WHERE src."kki" = $1  LIMIT 1
 * Tanpa ANY, tanpa id_kelurahan di SQL (filter kelurahan di app setelah fetch).
 */
function sqlExactEqOnPartition(qualified: string): string {
  return `
SELECT ${DETAIL_SELECT}
FROM ${qualified} src
WHERE src."kki" = $1
LIMIT 1
`;
}

function buildDiag(args: {
  relation: StuntingHeadPartitionRelation;
  sql: string;
  params: unknown[];
  kkiRaw: string;
  attempt: string;
}) {
  const kki = describeKkiForDiag(args.kkiRaw);
  return {
    schema: args.relation.schema,
    table: args.relation.table,
    qualified: args.relation.qualified,
    idProvinsi: args.relation.idProvinsi,
    suffix: args.relation.suffix,
    sql: args.sql.replace(/\s+/g, " ").trim(),
    params: args.params,
    paramsVisible: (args.params as unknown[]).map((p) => {
      if (Array.isArray(p)) {
        return p.map((x) =>
          typeof x === "string" ? x.replace(/ /g, "·") : x,
        );
      }
      return typeof p === "string" ? p.replace(/ /g, "·") : p;
    }),
    kki,
    attempt: args.attempt,
    note:
      "provinsiId = id_provinsi internal (Jabar=12 → stunting_head_12). Bukan kode BPS 32.",
  };
}

/**
 * Fajar: index btree(kki) belum bisa dibuat; OK query >4s (EXPLAIN ~1.9s seq scan).
 * Naikkan timeout **hanya** di path detail — jangan ubah pool global.
 */
const VERVAL_DETAIL_TIMEOUT_MS = 20_000;

async function queryVervalDetail<T extends StuntingHeadRowRow>(
  text: string,
  params: unknown[],
  diagBase: ReturnType<typeof buildDiag>,
): Promise<QueryResult<T>> {
  const config = getPoolConfigs().verval;
  const pool = getPool("verval");
  const client = await pool.connect();
  try {
    // SET LOCAL hanya berlaku dalam transaksi — aman dikembalikan ke pool.
    await client.query("BEGIN");
    await client.query(
      `SET LOCAL statement_timeout = '${VERVAL_DETAIL_TIMEOUT_MS}'`,
    );
    const result = await client.query<T>({
      text,
      values: params,
      // Client-side mirror (node-pg); server pakai SET LOCAL di atas.
      query_timeout: VERVAL_DETAIL_TIMEOUT_MS,
    } as { text: string; values: unknown[]; query_timeout: number });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    logPostgresError("query failed (verval detail)", err, {
      pool: "verval",
      url: config.url,
    });
    console.error("[keluarga-detail] SQL exact", {
      qualified: diagBase.qualified,
      sql: diagBase.sql,
      paramsVisible: diagBase.paramsVisible,
      kki: diagBase.kki,
      timeoutMs: VERVAL_DETAIL_TIMEOUT_MS,
    });
    const hint = config.url ? redactDatabaseUrl(config.url) : config.envKey;
    const missingTable =
      err instanceof Error &&
      /relation .* does not exist|undefined_table/i.test(err.message);
    if (missingTable) {
      throw new PostgresDataError(
        "partition_not_found",
        `Tabel partisi ${diagBase.qualified} tidak ditemukan (${hint}).`,
        { pool: "verval", cause: err, status: 404, details: diagBase },
      );
    }
    const timedOut =
      err instanceof Error &&
      /timeout|canceling statement/i.test(err.message);
    throw new PostgresDataError(
      timedOut ? "postgres_query_timeout" : "postgres_query_failed",
      timedOut
        ? `Query verval timeout ${VERVAL_DETAIL_TIMEOUT_MS}ms pada ${diagBase.qualified} (${hint}). Seq scan tanpa index kki; lihat diag.sql.`
        : `Query verval gagal pada ${diagBase.qualified} (${hint}).`,
      {
        pool: "verval",
        cause: err,
        status: 503,
        details: { ...diagBase, timeoutMs: VERVAL_DETAIL_TIMEOUT_MS },
      },
    );
  } finally {
    client.release();
  }
}

/**
 * Baca 1 keluarga dari **tabel partisi**
 * `"verval2024_monitoring"."stunting_head_{NN}"` (NN = id_provinsi pad 2).
 *
 * Pola Fajar persis:
 * ```sql
 * SELECT … FROM "verval2024_monitoring"."stunting_head_12" src
 * WHERE src."kki" = $1
 * LIMIT 1
 * ```
 * `$1` = padded primary (`14` + 6 spasi + sisa). Tanpa ANY / id_kelurahan / replace.
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
      "Parameter provinsiId wajib — id_provinsi internal untuk stunting_head_{NN} (Jabar=12, bukan BPS 32).",
      { pool: "verval", status: 400 },
    );
  }

  const relation = stuntingHeadPartitionRelation(Math.trunc(query.provinsiId));
  const { qualified } = relation;

  const paddedPrimary = primaryPaddedKki(query.kki);
  if (!paddedPrimary) {
    throw new PostgresDataError(
      "invalid_kki",
      "KKI terlalu pendek untuk bentuk padded (butuh ≥15 digit compact).",
      {
        pool: "verval",
        status: 400,
        details: describeKkiForDiag(query.kki),
      },
    );
  }

  const kelurahanId =
    query.kelurahanId != null && Number.isFinite(query.kelurahanId)
      ? Math.trunc(query.kelurahanId)
      : null;

  const sql = sqlExactEqOnPartition(qualified);
  const params: unknown[] = [paddedPrimary];
  const diag = {
    ...buildDiag({
      relation,
      sql,
      params,
      kkiRaw: query.kki,
      attempt: "exact_kki_eq",
    }),
    kelurahanId,
    kelurahanFilter: "app_after_fetch",
  };

  if (query.diag) {
    console.info("[keluarga-detail] diag pre-query", diag);
  }

  const res = await queryVervalDetail<StuntingHeadRowRow>(sql, params, diag);
  let row: StuntingHeadRowRow | undefined = res.rows[0];

  // Filter kelurahan di app (bukan di SQL hot path) — sesuai permintaan Fajar.
  if (
    row &&
    kelurahanId != null &&
    row.id_kelurahan != null &&
    Number(row.id_kelurahan) !== kelurahanId
  ) {
    row = undefined;
  }

  if (!row) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Detail keluarga tidak ditemukan untuk KKI padded di ${qualified}.`,
      {
        pool: "verval",
        status: 404,
        details: query.diag
          ? diag
          : { qualified, kki: describeKkiForDiag(query.kki) },
      },
    );
  }

  const item = mapStuntingHeadRow(row);
  if (!item) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Baris stunting_head tidak valid untuk KKI ${compact}.`,
      { pool: "verval", status: 404, details: query.diag ? diag : null },
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
      ...(query.diag
        ? {
            diag: {
              qualified: relation.qualified,
              sql: diag.sql,
              paramsVisible: diag.paramsVisible,
              kki: describeKkiForDiag(query.kki),
              matchedKki:
                typeof row.kki === "string" ? row.kki.replace(/ /g, "·") : row.kki,
            },
          }
        : {}),
    },
  };
}
