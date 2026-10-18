/**
 * Stub triple-pool Postgres (fase 1).
 *
 * Host terpisah:
 * - SIGA  → TPK / anggota / PKB (`sigabaru`)
 * - WILAYAH → label `v_*` (`pk2025`)
 * - DWH → rekap KRS (`dwh_pk2025`)
 *
 * Belum membuka koneksi nyata. Fase berikutnya: pasang driver `pg`
 * dan buat Pool per URL yang terisi.
 */

export type PoolKind = "siga" | "wilayah" | "dwh";

export type PoolConfig = {
  kind: PoolKind;
  envKey: string;
  url: string | null;
  ready: boolean;
};

function readUrl(envKey: string): string | null {
  const value = process.env[envKey]?.trim();
  return value ? value : null;
}

export function getPoolConfigs(): Record<PoolKind, PoolConfig> {
  const sigaUrl = readUrl("DATABASE_URL_SIGA");
  const wilayahUrl = readUrl("DATABASE_URL_WILAYAH");
  const dwhUrl = readUrl("DATABASE_URL_DWH");

  return {
    siga: {
      kind: "siga",
      envKey: "DATABASE_URL_SIGA",
      url: sigaUrl,
      ready: Boolean(sigaUrl),
    },
    wilayah: {
      kind: "wilayah",
      envKey: "DATABASE_URL_WILAYAH",
      url: wilayahUrl,
      ready: Boolean(wilayahUrl),
    },
    dwh: {
      kind: "dwh",
      envKey: "DATABASE_URL_DWH",
      url: dwhUrl,
      ready: Boolean(dwhUrl),
    },
  };
}

/** true hanya jika ketiga URL terisi (siap query live). */
export function arePostgresPoolsConfigured(): boolean {
  const pools = getPoolConfigs();
  return pools.siga.ready && pools.wilayah.ready && pools.dwh.ready;
}

/**
 * Placeholder koneksi — belum membuat client.
 * Return null agar pemanggil fallback ke mock.
 */
export async function getPool(_kind: PoolKind): Promise<null> {
  // TODO(fase-2): new Pool({ connectionString: getPoolConfigs()[kind].url })
  return null;
}
