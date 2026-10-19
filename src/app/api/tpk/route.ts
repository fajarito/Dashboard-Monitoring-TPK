import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchTpkList,
  parseTpkListQuery,
} from "@/lib/data";
import {
  isPostgresDataError,
} from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/tpk?provinsiId=&kabupatenId=&q=&page=&pageSize=&sort=
 * Daftar TPK aktif (Status=1) dengan paging — tanpa by_name DWH, tanpa full dump.
 * pageSize default 25 (10–50). Filter wilayah wajib.
 * sort: krs-desc (default) | krs-asc | ibuHamil-desc | baduta-desc | balita-desc | rtlh-desc | nama
 * Item memuat indikator kelurahan (by_rekap) + PKB desa binaan; null → UI "—".
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseTpkListQuery(request.nextUrl.searchParams);
    const payload = await fetchTpkList(query);

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
    console.error("[api/tpk] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat daftar TPK.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
