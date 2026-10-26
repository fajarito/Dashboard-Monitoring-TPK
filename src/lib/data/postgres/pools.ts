/**
 * Triple-pool Postgres (beda host):
 * - SIGA  → TPK / anggota / PKB (`sigabaru`)
 * - WILAYAH → label `v_*` (`pk2025`)
 * - DWH → rekap KRS (`dwh_pk2025`)
 */

import { Pool, type QueryResult, type QueryResultRow } from "pg";

import {
  logPostgresError,
  PostgresDataError,
  redactDatabaseUrl,
  type PoolKind,
} from "@/lib/data/postgres/errors";

export type { PoolKind };

export type PoolConfig = {
  kind: PoolKind;
  envKey: string;
  url: string | null;
  ready: boolean;
};

const ENV_KEYS: Record<PoolKind, string> = {
  siga: "DATABASE_URL_SIGA",
  wilayah: "DATABASE_URL_WILAYAH",
  dwh: "DATABASE_URL_DWH",
};

type GlobalPools = {
  __tpkPgPools?: Partial<Record<PoolKind, Pool>>;
};

function readUrl(envKey: string): string | null {
  const value = process.env[envKey]?.trim();
  return value ? value : null;
}

export function getPoolConfigs(): Record<PoolKind, PoolConfig> {
  const kinds: PoolKind[] = ["siga", "wilayah", "dwh"];
  const result = {} as Record<PoolKind, PoolConfig>;
  for (const kind of kinds) {
    const envKey = ENV_KEYS[kind];
    const url = readUrl(envKey);
    result[kind] = { kind, envKey, url, ready: Boolean(url) };
  }
  return result;
}

/** true hanya jika ketiga URL terisi (siap query live). */
export function arePostgresPoolsConfigured(): boolean {
  const pools = getPoolConfigs();
  return pools.siga.ready && pools.wilayah.ready && pools.dwh.ready;
}

function poolStore(): Partial<Record<PoolKind, Pool>> {
  const g = globalThis as typeof globalThis & GlobalPools;
  if (!g.__tpkPgPools) g.__tpkPgPools = {};
  return g.__tpkPgPools;
}

/**
 * Ambil Pool untuk kind. Throw jika URL kosong (pemanggil harus cek
 * arePostgresPoolsConfigured dulu untuk jalur fallback mock).
 */
export function getPool(kind: PoolKind): Pool {
  const config = getPoolConfigs()[kind];
  if (!config.url) {
    throw new PostgresDataError(
      "pool_not_configured",
      `Pool ${kind} belum dikonfigurasi (${config.envKey} kosong).`,
      { pool: kind, status: 503 },
    );
  }

  const store = poolStore();
  const existing = store[kind];
  if (existing) return existing;

  // Timeout ketat: readiness lama 5s; jangan biarkan koneksi/query menggantung 8s+.
  // query_timeout = client-side; statement_timeout = server-side (pg).
  const pool = new Pool({
    connectionString: config.url,
    max: 4,
    idleTimeoutMillis: 15_000,
    connectionTimeoutMillis: 3_000,
    query_timeout: 4_000,
    statement_timeout: 4_000,
    application_name: `dashboard-tpk-${kind}`,
  });

  pool.on("error", (err) => {
    logPostgresError(`pool idle error (${kind})`, err, {
      pool: kind,
      url: config.url,
    });
  });

  store[kind] = pool;
  return pool;
}

/** Klasifikasi penyebab tanpa membocorkan secret (untuk log + pesan UI). */
export function classifyPostgresFailure(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";
  if (
    /timeout|ETIMEDOUT|Query read timeout|canceling statement due to statement timeout/i.test(
      msg,
    ) ||
    code === "ETIMEDOUT"
  ) {
    return "timeout";
  }
  if (
    /ECONNREFUSED|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|getaddrinfo|Connection terminated unexpectedly|server closed the connection/i.test(
      msg,
    ) ||
    /ECONNREFUSED|ENOTFOUND|ENETUNREACH/.test(code)
  ) {
    return "connection";
  }
  if (/too many clients|remaining connection slots|connection pool/i.test(msg)) {
    return "pool_exhausted";
  }
  return "query_error";
}

/** Query typed + error wrapping (log aman, tanpa password). */
export async function queryPool<T extends QueryResultRow = QueryResultRow>(
  kind: PoolKind,
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const config = getPoolConfigs()[kind];
  const pool = getPool(kind);
  try {
    return await pool.query<T>(text, params);
  } catch (err) {
    const reason = classifyPostgresFailure(err);
    logPostgresError(`query failed (${kind}) [${reason}]`, err, {
      pool: kind,
      url: config.url,
    });
    const hint = config.url ? redactDatabaseUrl(config.url) : config.envKey;
    throw new PostgresDataError(
      reason === "timeout"
        ? "postgres_timeout"
        : reason === "connection"
          ? "postgres_connection_failed"
          : reason === "pool_exhausted"
            ? "postgres_pool_exhausted"
            : "postgres_query_failed",
      `Query ${kind} gagal (${reason}: ${hint}). Periksa koneksi/SQL — lihat log server.`,
      { pool: kind, cause: err, status: 503 },
    );
  }
}

/** Periode DWH (default 2025 — semester1 PK25). */
export function getDwhPeriode(): number {
  const raw = process.env.DWH_PERIODE?.trim();
  if (!raw) return 2025;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 2025;
}
