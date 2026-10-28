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
 * GET /api/keluarga/detail?kki=&provinsiId=&diag=1
 * Detail 1 KK dari `"verval2024_monitoring"."stunting_head_{NN}"`.
 * Pola Fajar: `WHERE src."kki" = $1` — `$1` = padded primary (14+6spasi+sisa).
 * Tanpa ANY / id_kelurahan di SQL. `diag=1` / timeout → SQL exact + param.
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
    // 400/404/503 — selalu sertakan diag bila ada (timeout wajib terlihat).
    if (isPostgresDataError(err)) {
      const postgres = postgresErrorResponse(err);
      if (postgres) return postgres;
    }
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
