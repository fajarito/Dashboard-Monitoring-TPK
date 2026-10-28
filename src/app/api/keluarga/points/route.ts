import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchKrsPoints,
  parseKrsPointsQuery,
} from "@/lib/data";
import { isPostgresDataError } from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/keluarga/points?kelurahanId=&provinsiId=&prioritas=&indikator=&bbox=&validCoordsOnly=&q=&limit=&offset=
 * Pin keluarga/KRS grain kelurahan (by_name). Hard max ~2000. Cache ~60 dtk.
 * Hanya kelurahan — tidak untuk kecamatan/nasional.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseKrsPointsQuery(request.nextUrl.searchParams);
    const payload = await fetchKrsPoints(query);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": cacheControlHeader(DEFAULT_CACHE_TTL_SEC),
        "X-Cache-TTL": String(DEFAULT_CACHE_TTL_SEC),
        "X-Data-Source": payload.meta.source,
      },
    });
  } catch (err) {
    if (isPostgresDataError(err) && (err.status === 400 || err.status === 404)) {
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
    console.error("[api/keluarga/points] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat pin KRS kelurahan.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
