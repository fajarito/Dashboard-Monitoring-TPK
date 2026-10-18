import { NextRequest, NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchRingkasan,
  parseRingkasanQuery,
} from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/ringkasan?tingkat=nasional|provinsi|kabupaten&id=
 * Alias tingkat: kab → kabupaten. id = ProvinsiID / KabupatenID (bukan BPS).
 * Satu payload agregat untuk first paint home (tanpa by_name).
 * Jika DATA_SOURCE=postgres dan pool terisi tetapi query gagal → 503 JSON jelas.
 */
export async function GET(request: NextRequest) {
  try {
    const query = parseRingkasanQuery(request.nextUrl.searchParams);
    const payload = await fetchRingkasan(query);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": cacheControlHeader(DEFAULT_CACHE_TTL_SEC),
        "X-Cache-TTL": String(DEFAULT_CACHE_TTL_SEC),
        "X-Data-Source": payload.meta.source,
      },
    });
  } catch (err) {
    const postgres = postgresErrorResponse(err);
    if (postgres) return postgres;
    console.error("[api/ringkasan] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat ringkasan.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
