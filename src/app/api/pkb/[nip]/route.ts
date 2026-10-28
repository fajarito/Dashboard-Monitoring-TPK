import { NextRequest, NextResponse } from "next/server";

import {
  fetchPkbFromPortal,
  getPkbPortalAuthDiag,
  getPkbPortalToken,
} from "@/lib/pkb-portal";
import {
  resolvePortalLookupKey,
  type PkbPortalLookupKey,
} from "@/lib/pkb-portal-lookup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ nip: string }>;
};

/**
 * GET /api/pkb/[key]?propinsi=&kabupaten=&statuspegawai=PKB
 * Alias query: lokasi_propinsi, lokasi_kabupaten, ktp=
 *
 * Path `[key]` = NIP 18-digit ATAU NIK/KTP 16-digit.
 * Query `?ktp=` menimpa path bila valid (16 digit).
 * Portal live: `ktp=<NIK>` (konfirmasi Fajar) atau `NIP=<NIP>`.
 * Response selalu menampilkan `NIP` dari portal (bukan NIK lokal).
 * ?diag=1 → meta auth (tanpa token).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { nip: rawPath } = await context.params;
  const pathKey = decodeURIComponent(rawPath || "").trim();
  const qKtp =
    request.nextUrl.searchParams.get("ktp")?.trim() ||
    request.nextUrl.searchParams.get("KTP")?.trim() ||
    request.nextUrl.searchParams.get("nik")?.trim() ||
    null;

  const lookup: PkbPortalLookupKey | null =
    resolvePortalLookupKey(qKtp) ?? resolvePortalLookupKey(pathKey);

  const diag = getPkbPortalAuthDiag();
  const wantDiag = request.nextUrl.searchParams.get("diag") === "1";

  if (!lookup) {
    return NextResponse.json(
      {
        error: "invalid_lookup",
        message:
          "Butuh NIP 18 digit atau NIK/KTP 16 digit. Kode wilayah (mis. 32010108) ditolak. Isi pkb.nik di payload TPK.",
        meta: wantDiag
          ? {
              ...diag,
              pathKey: pathKey || null,
              qKtp: qKtp || null,
              generatedAt: new Date().toISOString(),
            }
          : undefined,
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

  const { enrichment, httpStatus } = await fetchPkbFromPortal(lookup, {
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
          ? `PKB tidak ditemukan di portal untuk ${lookup.kind}=${lookup.value}.`
          : "PKB_PORTAL_API_TOKEN belum terbaca proses Next (isi .env.local lalu restart next dev).",
        lookup,
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
      // NIP tampilan = response portal (bukan NIK/KTP yang dipakai lookup).
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
        lookupKind: lookup.kind,
        lookupValue: lookup.value,
        simsdmFotoBase: process.env.SIMSDM_FOTO_BASE_URL?.trim() || null,
        ...diag,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Pkb-Source": enrichment.source,
        "X-Pkb-Lookup": lookup.kind,
      },
    },
  );
}
