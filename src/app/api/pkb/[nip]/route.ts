import { NextRequest, NextResponse } from "next/server";

import {
  fetchPkbFromPortal,
  getPkbPortalAuthDiag,
  getPkbPortalToken,
  type FetchPkbPortalReason,
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

function statusForReason(reason: FetchPkbPortalReason): number {
  switch (reason) {
    case "token_missing":
      return 503;
    case "invalid_lookup":
      return 400;
    case "portal_empty":
    case "portal_http_error":
    case "portal_unreachable":
      return 404;
    default:
      return 404;
  }
}

function messageForReason(
  reason: FetchPkbPortalReason,
  lookup: PkbPortalLookupKey,
): string {
  switch (reason) {
    case "token_missing":
      return "PKB_PORTAL_API_TOKEN belum terbaca proses Next (isi .env.local lalu restart next dev).";
    case "portal_empty":
      return `Portal 200 tapi data kosong / tidak ter-parse untuk ${lookup.kind}=${lookup.value}.`;
    case "portal_http_error":
      return `Portal menolak request untuk ${lookup.kind}=${lookup.value} (cek meta.attempts).`;
    case "portal_unreachable":
      return "Portal tidak terjangkau dari server Next.";
    default:
      return `PKB tidak ditemukan untuk ${lookup.kind}=${lookup.value}.`;
  }
}

/**
 * GET /api/pkb/[key]?lokasi_kecamatan=&lokasi_kelurahan=&ktp=&diag=1
 *
 * Proxy → upstream SELALU `{base}/api/pkb?ktp=…` (query params only).
 * Path `[key]` hanya untuk Next route kita, bukan path portal.
 * `diag=1` → meta.attempts berisi upstreamUrl + status + bodySnippet.
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
  // statuspegawai opsional — jangan default-force di fetch (over-filter).
  // Tetap diteruskan bila client kirim; fetch menaruhnya di attempt terakhir.
  const statuspegawai = q.get("statuspegawai")?.trim() || undefined;

  if (!lookup) {
    return NextResponse.json(
      {
        error: "invalid_lookup",
        reason: "invalid_lookup",
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

  const { enrichment, httpStatus, reason, attempts } = await fetchPkbFromPortal(
    lookup,
    {
      ...lokasiNames,
      statuspegawai,
    },
  );

  if (!enrichment) {
    const errorCode =
      reason === "token_missing"
        ? "portal_token_missing"
        : reason === "portal_empty"
          ? "pkb_empty"
          : reason === "portal_http_error"
            ? "portal_http_error"
            : reason === "portal_unreachable"
              ? "portal_unreachable"
              : "pkb_not_found";
    return NextResponse.json(
      {
        error: errorCode,
        reason,
        message: messageForReason(reason, lookup),
        lookup,
        portalHttpStatus: httpStatus,
        meta: {
          generatedAt: new Date().toISOString(),
          lokasi: lokasiNames,
          // Selalu kirim attempts saat gagal agar Fajar bisa curl ulang upstreamUrl
          attempts,
          ...diag,
        },
      },
      {
        status: statusForReason(reason),
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    {
      NIP: enrichment.nip,
      nip: enrichment.nip,
      nama: enrichment.nama,
      nohp: enrichment.nohp,
      jenispegawai: enrichment.jenisPegawai,
      statuspegawai: enrichment.statusPegawai,
      lokasi_propinsi: enrichment.lokasiPropinsi,
      lokasi_kabupaten: enrichment.lokasiKabupaten,
      lokasi_kecamatan: enrichment.lokasiKecamatan,
      lokasi_kelurahan: enrichment.lokasiKelurahan,
      email_dinas: enrichment.emailDinas,
      jab_akhir: enrichment.jabAkhir,
      foto: enrichment.fotoFile,
      pelatihanLabels: enrichment.pelatihanLabels,
      emailDinas: enrichment.emailDinas,
      jabAkhir: enrichment.jabAkhir,
      statusPegawai: enrichment.statusPegawai,
      jenisPegawai: enrichment.jenisPegawai,
      lokasiPropinsi: enrichment.lokasiPropinsi,
      lokasiKabupaten: enrichment.lokasiKabupaten,
      lokasiKecamatan: enrichment.lokasiKecamatan,
      lokasiKelurahan: enrichment.lokasiKelurahan,
      fotoFile: enrichment.fotoFile,
      fotoUrl: enrichment.fotoUrl,
      source: enrichment.source,
      warning: enrichment.error,
      meta: {
        generatedAt: new Date().toISOString(),
        portalHttpStatus: httpStatus,
        lookupKind: lookup.kind,
        lookupValue: lookup.value,
        reason,
        lokasi: lokasiNames,
        attempts: wantDiag ? attempts : undefined,
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
        "X-Pkb-Reason": reason,
      },
    },
  );
}
