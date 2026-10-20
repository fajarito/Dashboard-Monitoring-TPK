import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchPeringkatKecamatan,
} from "@/lib/data";
import {
  isPostgresDataError,
  PostgresDataError,
} from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/peringkat/kecamatan?kabupatenId=
 * Ranking kecamatan dalam satu kab/kota — max ~120 baris, cache 60s.
 * id = id_kecamatan (bukan Depdagri).
 */
export async function GET(request: NextRequest) {
  try {
    const kabupatenId = request.nextUrl.searchParams.get("kabupatenId");
    if (!kabupatenId?.trim()) {
      throw new PostgresDataError(
        "missing_kabupaten_id",
        "Parameter kabupatenId wajib (KabupatenID / id_kabupaten).",
        { status: 400 },
      );
    }
    const payload = await fetchPeringkatKecamatan(kabupatenId.trim());

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": cacheControlHeader(DEFAULT_CACHE_TTL_SEC),
        "X-Cache-TTL": String(DEFAULT_CACHE_TTL_SEC),
        "X-Data-Source": payload.meta.source,
      },
    });
  } catch (err) {
    if (isPostgresDataError(err) && err.status === 400) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
          meta: {
            source: "postgres-error" as const,
            generatedAt: new Date().toISOString(),
          },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const postgres = postgresErrorResponse(err);
    if (postgres) return postgres;
    console.error("[api/peringkat/kecamatan] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat peringkat kecamatan.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
