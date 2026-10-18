import { NextRequest, NextResponse } from "next/server";

import {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
  fetchRingkasan,
  parseRingkasanQuery,
} from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/ringkasan?tingkat=nasional|provinsi&id=
 * Satu payload agregat untuk first paint home (tanpa by_name).
 */
export async function GET(request: NextRequest) {
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
}
