import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchKeluargaDetail,
  parseKeluargaDetailQuery,
} from "@/lib/data";
import { isPostgresDataError } from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/keluarga/detail?kki=&provinsiId=
 * Detail 1 KK dari tabel partisi `verval2024_monitoring.stunting_head_{NN}`.
 * Live: `provinsiId` → NN (pad 2). Match `kki =` bentuk padded; compact hanya fallback.
 * Contoh: `SELECT * FROM stunting_head_01 WHERE kki = '11061020310200      001019026'`
 * Pool: DATABASE_URL_VERVAL. Unset → mock.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseKeluargaDetailQuery(request.nextUrl.searchParams);
    const payload = await fetchKeluargaDetail(query);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": cacheControlHeader(DEFAULT_CACHE_TTL_SEC),
        "X-Cache-TTL": String(DEFAULT_CACHE_TTL_SEC),
        "X-Data-Source": payload.meta.source,
      },
    });
  } catch (err) {
    if (
      isPostgresDataError(err) &&
      (err.status === 400 || err.status === 404)
    ) {
      return NextResponse.json(
        {
          error: err.code,
          message: err.message,
          meta: {
            source: "postgres-error" as const,
            generatedAt: new Date().toISOString(),
          },
        },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    const postgres = postgresErrorResponse(err);
    if (postgres) return postgres;
    console.error("[api/keluarga/detail] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat detail keluarga.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
