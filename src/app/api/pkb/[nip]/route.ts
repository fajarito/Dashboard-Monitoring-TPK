import { NextRequest, NextResponse } from "next/server";

import {
  fetchPkbFromPortal,
  getPkbPortalAuthDiag,
  getPkbPortalToken,
} from "@/lib/pkb-portal";
import {
  resolvePortalLokasiNames,
  resolvePortalLookupKey,
  type PkbPortalLookupKey,
} from "@/lib/pkb-portal-lookup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ nip: string }>;
};

/**
 * GET /api/pkb/[key]?lokasi_propinsi=&lokasi_kabupaten=&lokasi_kecamatan=&lokasi_kelurahan=
 *
 * Path `[key]` = NIP 18-digit ATAU NIK/KTP 16-digit.
 * Query `?ktp=` menimpa path bila valid (16 digit).
 * Lokasi filter = **nama** (UPPER), bukan kode — contoh Fajar:
 *   `?ktp=…&lokasi_kecamatan=BOJONG%20GEDE&lokasi_kelurahan=SUSUKAN`
 * Response selalu menampilkan `NIP` dari portal.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { nip: rawPath } = await context.params;
  const pathKey = decodeURIComponent(rawPath || "").trim();
  const q = request.nextUrl.searchParams;
  const qKtp =
    q.get("ktp")?.trim() ||
    q.get("KTP")?.trim() ||
    q.get("nik")?.trim() ||
    null;

  const lookup: PkbPortalLookupKey | null =
    resolvePortalLookupKey(qKtp) ?? resolvePortalLookupKey(pathKey);

  const diag = getPkbPortalAuthDiag();
  const wantDiag = q.get("diag") === "1";

  const lokasiNames = resolvePortalLokasiNames({
    propinsi: q.get("lokasi_propinsi") || q.get("propinsi"),
    kabupaten: q.get("lokasi_kabupaten") || q.get("kabupaten"),
    kecamatan: q.get("lokasi_kecamatan") || q.get("kecamatan"),
    kelurahan: q.get("lokasi_kelurahan") || q.get("kelurahan"),
  });
  const statuspegawai = q.get("statuspegawai")?.trim() || "PKB";

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
              lokasi: lokasiNames,
              generatedAt: new Date().toISOString(),
            }
          : undefined,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { enrichment, httpStatus } = await fetchPkbFromPortal(lookup, {
    ...lokasiNames,
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
          lokasi: lokasiNames,
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
        lokasi: lokasiNames,
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
