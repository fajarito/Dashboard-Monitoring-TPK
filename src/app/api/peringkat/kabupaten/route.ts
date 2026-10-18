import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchPeringkatKabupaten,
} from "@/lib/data";
import {
  isPostgresDataError,
  PostgresDataError,
} from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/peringkat/kabupaten?provinsiId=
 * Ranking kab/kota dalam satu provinsi — max ~80 baris, cache 60s.
 * Field: id (id_kabupaten), nama, tpk, pkb, desa, krs, rasio, rasioPkbDesa, warningBeban.
 */
export async function GET(request: NextRequest) {
  try {
    const provinsiId = request.nextUrl.searchParams.get("provinsiId");
    if (!provinsiId?.trim()) {
      throw new PostgresDataError(
        "missing_provinsi_id",
        "Parameter provinsiId wajib (ProvinsiID / id_provinsi).",
        { status: 400 },
      );
    }
    const payload = await fetchPeringkatKabupaten(provinsiId.trim());

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
    console.error("[api/peringkat/kabupaten] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat peringkat kabupaten/kota.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
