import { NextResponse } from "next/server";

import { isPostgresDataError } from "@/lib/data/postgres/errors";

/** Bentuk JSON error jelas untuk koneksi/SQL Postgres. */
export function postgresErrorResponse(err: unknown): NextResponse | null {
  if (!isPostgresDataError(err)) return null;

  return NextResponse.json(
    {
      error: err.code,
      message: err.message,
      pool: err.pool,
      meta: {
        source: "postgres-error" as const,
        generatedAt: new Date().toISOString(),
      },
    },
    {
      status: err.status,
      headers: {
        "Cache-Control": "no-store",
        "X-Data-Source": "postgres-error",
      },
    },
  );
}
