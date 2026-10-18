import { NextResponse } from "next/server";

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
 */
export async function GET() {
  const payload = await fetchPeringkatProvinsi();

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": cacheControlHeader(DEFAULT_CACHE_TTL_SEC),
      "X-Cache-TTL": String(DEFAULT_CACHE_TTL_SEC),
      "X-Data-Source": payload.meta.source,
    },
  });
}
