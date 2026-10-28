/** Pool ke-4 `verval` = host volt_verval / stunting_head (bukan SIGA). */
export type PoolKind = "siga" | "wilayah" | "dwh" | "verval";

/**
 * Error data layer Postgres — API route mengembalikan 503 JSON jelas.
 * Jangan fallback diam-diam ke mock jika URL pool sudah terisi.
 */
export class PostgresDataError extends Error {
  readonly code: string;
  readonly pool: PoolKind | null;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    options?: { pool?: PoolKind | null; cause?: unknown; status?: number },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "PostgresDataError";
    this.code = code;
    this.pool = options?.pool ?? null;
    this.status = options?.status ?? 503;
  }
}

/** Redaksi password dari connection string untuk log aman. */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "[invalid-database-url]";
  }
}

/** Log error DB tanpa membocorkan password. */
export function logPostgresError(
  context: string,
  err: unknown,
  extras?: { pool?: PoolKind; url?: string | null },
) {
  const safeUrl = extras?.url ? redactDatabaseUrl(extras.url) : undefined;
  const detail =
    err instanceof Error
      ? { name: err.name, message: err.message }
      : { message: String(err) };
  console.error("[postgres]", context, {
    ...detail,
    pool: extras?.pool,
    url: safeUrl,
  });
}

export function isPostgresDataError(err: unknown): err is PostgresDataError {
  return err instanceof PostgresDataError;
}
