import { NextResponse } from "next/server";

import { postgresErrorResponse } from "@/lib/data/api-error";
import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchPeringkatProvinsi,
} from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/peringkat/provinsi
 * List ringan untuk tabel ranking (id, nama, tpk, krs, rasio) — max 40 baris.
 * Jika DATA_SOURCE=postgres dan pool terisi tetapi query gagal → 503 JSON jelas.
 */
export async function GET() {
  try {
    const payload = await fetchPeringkatProvinsi();

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
    console.error("[api/peringkat/provinsi] unexpected", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: "Gagal memuat peringkat provinsi.",
        meta: {
          source: "postgres-error",
          generatedAt: new Date().toISOString(),
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
