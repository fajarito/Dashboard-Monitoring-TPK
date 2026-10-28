import { NextRequest, NextResponse } from "next/server";

import {
  buildSimsdmFotoUrl,
  getSimsdmFotoBaseUrl,
} from "@/lib/pkb-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Proxy foto SIMSDM → same-origin agar <img> tidak gagal karena
 * hotlink / CORS / timeout browser ke simsdm.bkkbn.go.id.
 *
 * GET /api/pkb/foto?file=nama.jpg
 * GET /api/pkb/foto?url=https://simsdm.../pictures/nama.jpg
 */
export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get("file")?.trim();
  const urlParam = request.nextUrl.searchParams.get("url")?.trim();

  let upstream: string | null = null;
  if (urlParam) {
    try {
      const parsed = new URL(urlParam);
      const allowedHost = new URL(getSimsdmFotoBaseUrl()).hostname;
      if (parsed.hostname !== allowedHost) {
        return NextResponse.json(
          { error: "invalid_foto_host", message: "Host foto tidak diizinkan." },
          { status: 400 },
        );
      }
      upstream = parsed.toString();
    } catch {
      return NextResponse.json(
        { error: "invalid_foto_url", message: "URL foto tidak valid." },
        { status: 400 },
      );
    }
  } else if (file) {
    // Tolak path traversal
    if (file.includes("..") || file.includes("/") || file.includes("\\")) {
      return NextResponse.json(
        { error: "invalid_foto_file", message: "Nama file foto tidak valid." },
        { status: 400 },
      );
    }
    upstream = buildSimsdmFotoUrl(file);
  }

  if (!upstream) {
    return NextResponse.json(
      { error: "missing_foto", message: "Parameter file atau url wajib." },
      { status: 400 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(upstream, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "image/*,*/*",
        // Beberapa CDN menolak hotlink kosong; kirim UA netral.
        "User-Agent": "dashboard-monitoring-tpk-foto-proxy/1.0",
      },
      cache: "force-cache",
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "foto_upstream_failed",
          message: `SIMSDM HTTP ${response.status}`,
          upstreamHost: new URL(upstream).hostname,
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Foto-Upstream": new URL(upstream).hostname,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "foto_fetch_error",
        message:
          err instanceof Error ? err.message : "Gagal mengambil foto SIMSDM",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
