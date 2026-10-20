import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchTpkDetail,
} from "@/lib/data";
import { isPostgresDataError } from "@/lib/data/postgres/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ tpkId: string }>;
};

/**
 * GET /api/tpk/[tpkId]
 * Identitas TPK + anggota + PKB desa binaan + agregat kelurahan (by_rekap).
 * Tidak scan by_name. Cache ~60 dtk. meta.source jujur (mock|postgres).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { tpkId: raw } = await context.params;
    const tpkId = decodeURIComponent(raw ?? "").trim();
    const payload = await fetchTpkDetail(tpkId);

    if (!payload) {
      return NextResponse.json(
        {
          error: "tpk_not_found",
          message: `TPK tidak ditemukan: ${tpkId || "(kosong)"}`,
          meta: {
            source: "postgres-error" as const,
            generatedAt: new Date().toISOString(),
          },
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

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
    console.error("[api/tpk/:tpkId] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat detail TPK.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
