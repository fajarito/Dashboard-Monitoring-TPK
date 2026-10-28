"use client";

import { useEffect, useState } from "react";

/** Payload proxy — field portal + alias UI. */
export type PkbPortalClientPayload = {
  /** NIP dari response portal. */
  NIP: string;
  nip: string;
  nama: string;
  nohp: string | null;
  jenispegawai: string | null;
  statuspegawai: string | null;
  lokasi_propinsi: string | null;
  lokasi_kabupaten: string | null;
  lokasi_kecamatan: string | null;
  email_dinas: string | null;
  jab_akhir: string | null;
  foto: string | null;
  emailDinas: string | null;
  jabAkhir: string | null;
  statusPegawai: string | null;
  jenisPegawai: string | null;
  lokasiPropinsi: string | null;
  lokasiKabupaten: string | null;
  lokasiKecamatan: string | null;
  fotoFile: string | null;
  fotoUrl: string | null;
  source: "portal" | "stub" | "fallback";
  warning: string | null;
};

export type PkbPortalLokasiInput = {
  propinsi?: string | null;
  kabupaten?: string | null;
  statuspegawai?: string | null;
};

export type UsePkbPortalState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  data: PkbPortalClientPayload | null;
  error: string | null;
};

/**
 * Enrich detail PKB dari proxy `/api/pkb/[nip]` (server pegang token).
 * `nip` argumen = kunci pencarian (biasanya PKBID SIGA); NIP tampilan = `data.NIP`.
 */
export function usePkbPortal(
  nip: string | null | undefined,
  lokasi: PkbPortalLokasiInput,
): UsePkbPortalState {
  const [state, setState] = useState<UsePkbPortalState>({
    status: "idle",
    data: null,
    error: null,
  });

  // Izinkan PKBID bermasker; server menormalisasi digit via resolvePortalLookupNip.
  const nipKey = (() => {
    const raw = nip?.trim() ?? "";
    if (!raw) return "";
    if (/^\d{8,25}$/.test(raw)) return raw;
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 25 ? digits : raw;
  })();
  const propinsi = lokasi.propinsi?.trim() ?? "";
  const kabupaten = lokasi.kabupaten?.trim() ?? "";
  const statuspegawai = lokasi.statuspegawai?.trim() || "PKB";

  useEffect(() => {
    if (!nipKey) {
      setState({
        status: "idle",
        data: null,
        error: "NIP lookup kosong (pkb.nip / pkbId tidak ada di payload TPK)",
      });
      return;
    }
    if (!/^\d{8,25}$/.test(nipKey)) {
      setState({
        status: "idle",
        data: null,
        error: `NIP lookup tidak valid untuk portal: "${nipKey}" (butuh 8–25 digit)`,
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", data: null, error: null });

    const params = new URLSearchParams();
    if (propinsi) params.set("lokasi_propinsi", propinsi);
    if (kabupaten) params.set("lokasi_kabupaten", kabupaten);
    // alias tetap dikirim agar kompatibel
    if (propinsi) params.set("propinsi", propinsi);
    if (kabupaten) params.set("kabupaten", kabupaten);
    params.set("statuspegawai", statuspegawai);

    void fetch(`/api/pkb/${encodeURIComponent(nipKey)}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404 || response.status === 503) {
          let message: string | null = null;
          try {
            const body = (await response.json()) as {
              message?: string;
              error?: string;
              meta?: { tokenConfigured?: boolean; tokenHadBearerPrefix?: boolean };
            };
            message = body?.message ?? body?.error ?? null;
            if (body?.meta?.tokenHadBearerPrefix) {
              message = `${message ?? "auth"} (env punya prefix Bearer — sudah di-strip di v4)`;
            }
            if (body?.meta && body.meta.tokenConfigured === false) {
              message =
                message ??
                "Token belum terbaca proses Next — restart next dev setelah isi .env.local";
            }
          } catch {
            /* ignore */
          }
          return { kind: "empty" as const, message };
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
          });
          return;
        }
        setState({ status: "ready", data: result.data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error:
            err instanceof Error
              ? err.message
              : "Gagal memuat detail portal PKB",
        });
      });

    return () => controller.abort();
  }, [nipKey, propinsi, kabupaten, statuspegawai]);

  return state;
}
