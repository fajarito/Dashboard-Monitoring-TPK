import { NextRequest, NextResponse } from "next/server";

import {
  fetchPkbFromPortal,
  getPkbPortalToken,
} from "@/lib/pkb-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ nip: string }>;
};

/**
 * GET /api/pkb/[nip]?propinsi=&kabupaten=&statuspegawai=PKB
 * Proxy server-side ke API portal (token tidak diekspos ke browser).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { nip: rawNip } = await context.params;
  const nip = decodeURIComponent(rawNip || "").trim();
  if (!nip || !/^\d{8,25}$/.test(nip)) {
    return NextResponse.json(
      {
        error: "invalid_nip",
        message: "Parameter NIP tidak valid.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const propinsi =
    request.nextUrl.searchParams.get("propinsi")?.trim() ||
    request.nextUrl.searchParams.get("lokasi_propinsi")?.trim() ||
    "";
  const kabupaten =
    request.nextUrl.searchParams.get("kabupaten")?.trim() ||
    request.nextUrl.searchParams.get("lokasi_kabupaten")?.trim() ||
    "";
  const statuspegawai =
    request.nextUrl.searchParams.get("statuspegawai")?.trim() || "PKB";

  const { enrichment, httpStatus } = await fetchPkbFromPortal(nip, {
    propinsi,
    kabupaten,
    statuspegawai,
  });

  if (!enrichment) {
    const hasToken = Boolean(getPkbPortalToken());
    return NextResponse.json(
      {
        error: hasToken ? "pkb_not_found" : "portal_token_missing",
        message: hasToken
          ? "PKB tidak ditemukan di portal untuk NIP ini."
          : "PKB_PORTAL_API_TOKEN belum di-set; tidak ada stub untuk NIP ini.",
        nip,
        portalHttpStatus: httpStatus,
      },
      {
        status: hasToken ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      nip: enrichment.nip,
      nama: enrichment.nama,
      nohp: enrichment.nohp,
      emailDinas: enrichment.emailDinas,
      jabAkhir: enrichment.jabAkhir,
      statusPegawai: enrichment.statusPegawai,
      jenisPegawai: enrichment.jenisPegawai,
      fotoUrl: enrichment.fotoUrl,
      fotoFile: enrichment.fotoFile,
      source: enrichment.source,
      warning: enrichment.error,
      meta: {
        generatedAt: new Date().toISOString(),
        portalHttpStatus: httpStatus,
        tokenConfigured: Boolean(getPkbPortalToken()),
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Pkb-Source": enrichment.source,
      },
    },
  );
}
