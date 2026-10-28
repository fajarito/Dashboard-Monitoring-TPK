import { NextRequest, NextResponse } from "next/server";

import {
  fetchPkbFromPortal,
  getPkbPortalAuthDiag,
  getPkbPortalToken,
  resolvePortalLookupNip,
} from "@/lib/pkb-portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ nip: string }>;
};

/**
 * GET /api/pkb/[nip]?propinsi=&kabupaten=&statuspegawai=PKB
 * Alias query: lokasi_propinsi, lokasi_kabupaten.
 * Proxy server-side ke API portal (token tidak diekspos ke browser).
 * ?diag=1 → meta auth (tanpa token) untuk debug lokal.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { nip: rawNip } = await context.params;
  const nip = resolvePortalLookupNip(decodeURIComponent(rawNip || ""));
  const diag = getPkbPortalAuthDiag();
  const wantDiag = request.nextUrl.searchParams.get("diag") === "1";

  if (!nip) {
    return NextResponse.json(
      {
        error: "invalid_nip",
        message:
          "Parameter NIP tidak valid (butuh 8–25 digit). Cek pkb.nip / pkbId di payload TPK.",
        meta: wantDiag ? { ...diag, generatedAt: new Date().toISOString() } : undefined,
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
          ? "PKB tidak ditemukan / tidak ter-parse dari portal untuk NIP ini."
          : "PKB_PORTAL_API_TOKEN belum terbaca proses Next (isi .env.local lalu restart next dev).",
        nip,
        portalHttpStatus: httpStatus,
        meta: {
          generatedAt: new Date().toISOString(),
          ...diag,
        },
      },
      {
        status: hasToken ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      // Field portal (semua ditampilkan di kartu; NIP = response.NIP, bukan NIK).
      NIP: enrichment.nip,
      nip: enrichment.nip,
      nama: enrichment.nama,
      nohp: enrichment.nohp,
      jenispegawai: enrichment.jenisPegawai,
      statuspegawai: enrichment.statusPegawai,
      lokasi_propinsi: enrichment.lokasiPropinsi,
      lokasi_kabupaten: enrichment.lokasiKabupaten,
      lokasi_kecamatan: enrichment.lokasiKecamatan,
      email_dinas: enrichment.emailDinas,
      jab_akhir: enrichment.jabAkhir,
      foto: enrichment.fotoFile,
      emailDinas: enrichment.emailDinas,
      jabAkhir: enrichment.jabAkhir,
      statusPegawai: enrichment.statusPegawai,
      jenisPegawai: enrichment.jenisPegawai,
      lokasiPropinsi: enrichment.lokasiPropinsi,
      lokasiKabupaten: enrichment.lokasiKabupaten,
      lokasiKecamatan: enrichment.lokasiKecamatan,
      fotoFile: enrichment.fotoFile,
      fotoUrl: enrichment.fotoUrl,
      source: enrichment.source,
      warning: enrichment.error,
      meta: {
        generatedAt: new Date().toISOString(),
        portalHttpStatus: httpStatus,
        lookupNip: nip,
        simsdmFotoBase: process.env.SIMSDM_FOTO_BASE_URL?.trim() || null,
        ...diag,
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
