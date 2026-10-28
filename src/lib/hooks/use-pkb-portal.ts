"use client";

import { useEffect, useState } from "react";

import {
  resolvePortalLokasiNames,
  resolvePortalLookupFromPkb,
  type PkbPortalLookupKey,
} from "@/lib/pkb-portal-lookup";

/** Payload proxy — field portal + alias UI. */
export type PkbPortalClientPayload = {
  /** NIP dari response portal (setelah lookup by NIP atau ktp). */
  NIP: string;
  nip: string;
  nama: string;
  nohp: string | null;
  jenispegawai: string | null;
  statuspegawai: string | null;
  lokasi_propinsi: string | null;
  lokasi_kabupaten: string | null;
  lokasi_kecamatan: string | null;
  lokasi_kelurahan: string | null;
  email_dinas: string | null;
  jab_akhir: string | null;
  foto: string | null;
  pelatihanLabels?: string[];
  emailDinas: string | null;
  jabAkhir: string | null;
  statusPegawai: string | null;
  jenisPegawai: string | null;
  lokasiPropinsi: string | null;
  lokasiKabupaten: string | null;
  lokasiKecamatan: string | null;
  lokasiKelurahan: string | null;
  fotoFile: string | null;
  fotoUrl: string | null;
  source: "portal" | "stub" | "fallback";
  warning: string | null;
  meta?: {
    lookupKind?: "nip" | "ktp";
    lookupValue?: string;
  };
};

export type PkbPortalLokasiInput = {
  /** Nama (bukan kode). */
  propinsi?: string | null;
  kabupaten?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
  statuspegawai?: string | null;
};

export type UsePkbPortalState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  data: PkbPortalClientPayload | null;
  error: string | null;
  /** Kode error API: portal_token_missing | pkb_empty | pkb_not_found | … */
  errorCode: string | null;
  lookup: PkbPortalLookupKey | null;
};

export type UsePkbPortalPkbInput = {
  nip?: string | null;
  pkbId?: string | null;
  nik?: string | null;
};

/**
 * Enrich detail PKB dari proxy `/api/pkb/[key]` (server pegang token).
 * Lookup: prefer NIP 18-digit, else NIK/KTP 16-digit → portal `?ktp=`.
 * NIP tampilan = `data.NIP` dari response portal.
 */
export function usePkbPortal(
  pkb: UsePkbPortalPkbInput | string | null | undefined,
  lokasi: PkbPortalLokasiInput,
): UsePkbPortalState {
  const [state, setState] = useState<UsePkbPortalState>({
    status: "idle",
    data: null,
    error: null,
    errorCode: null,
    lookup: null,
  });

  const lookup: PkbPortalLookupKey | null =
    typeof pkb === "string"
      ? resolvePortalLookupFromPkb({ nip: pkb, pkbId: pkb, nik: pkb })
      : resolvePortalLookupFromPkb(pkb);

  const lokasiNames = resolvePortalLokasiNames({
    propinsi: lokasi.propinsi,
    kabupaten: lokasi.kabupaten,
    kecamatan: lokasi.kecamatan,
    kelurahan: lokasi.kelurahan,
  });
  const statuspegawai = lokasi.statuspegawai?.trim() || "PKB";
  const lookupKind = lookup?.kind ?? "";
  const lookupValue = lookup?.value ?? "";
  const { propinsi, kabupaten, kecamatan, kelurahan } = lokasiNames;

  useEffect(() => {
    if (!lookup) {
      setState({
        status: "idle",
        data: null,
        lookup: null,
        errorCode: "invalid_lookup",
        error:
          "Lookup portal kosong — butuh NIP 18 digit atau NIK/KTP 16 digit di pkb (bukan kode wilayah)",
      });
      return;
    }

    const controller = new AbortController();
    setState({
      status: "loading",
      data: null,
      error: null,
      errorCode: null,
      lookup,
    });

    const params = new URLSearchParams();
    if (lookup.kind === "ktp") {
      params.set("ktp", lookup.value);
    }
    // Nama lokasi — server fetch mencoba kec+kel dulu, lalu ktp-only, baru filter penuh.
    if (propinsi) params.set("lokasi_propinsi", propinsi);
    if (kabupaten) params.set("lokasi_kabupaten", kabupaten);
    if (kecamatan) params.set("lokasi_kecamatan", kecamatan);
    if (kelurahan) params.set("lokasi_kelurahan", kelurahan);
    // Jangan force statuspegawai di query Next kecuali caller set eksplisit non-default.
    if (lokasi.statuspegawai?.trim()) {
      params.set("statuspegawai", statuspegawai);
    }
    params.set("diag", "1");

    const pathKey = encodeURIComponent(lookup.value);
    void fetch(`/api/pkb/${pathKey}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404 || response.status === 503) {
          let message: string | null = null;
          let errorCode: string | null = null;
          try {
            const body = (await response.json()) as {
              message?: string;
              error?: string;
              reason?: string;
              meta?: {
                tokenConfigured?: boolean;
                tokenHadBearerPrefix?: boolean;
              };
            };
            errorCode = body?.error ?? body?.reason ?? null;
            message = body?.message ?? null;
            if (errorCode === "portal_token_missing" || body?.meta?.tokenConfigured === false) {
              message =
                message ??
                "Token belum terbaca — isi PKB_PORTAL_API_TOKEN di .env.local lalu restart next dev";
              errorCode = "portal_token_missing";
            }
          } catch {
            /* ignore */
          }
          return { kind: "empty" as const, message, errorCode };
        }
        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const body = (await response.json()) as { message?: string };
            if (body?.message) detail = body.message;
          } catch {
            /* ignore */
          }
          throw new Error(detail);
        }
        const data = (await response.json()) as PkbPortalClientPayload;
        return { kind: "ready" as const, data };
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.kind === "empty") {
          setState({
            status: "empty",
            data: null,
            error: result.message ?? null,
            errorCode: result.errorCode ?? null,
            lookup,
          });
          return;
        }
        setState({
          status: "ready",
          data: result.data,
          error: null,
          errorCode: null,
          lookup,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          lookup,
          errorCode: "fetch_error",
          error:
            err instanceof Error
              ? err.message
              : "Gagal memuat detail portal PKB",
        });
      });

    return () => controller.abort();
    // lookupKind/Value + nama lokasi stabilkan deps tanpa objek baru tiap render
  }, [
    lookupKind,
    lookupValue,
    propinsi,
    kabupaten,
    kecamatan,
    kelurahan,
    statuspegawai,
  ]);

  return state;
}
