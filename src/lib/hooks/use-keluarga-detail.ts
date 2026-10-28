"use client";

import { useCallback, useEffect, useState } from "react";

import { primaryPaddedKki } from "@/lib/data/kki";
import type { KeluargaDetailPayload } from "@/lib/data/types";

export type KeluargaDetailStatus = "idle" | "loading" | "ready" | "error";

/** Fetch detail stunting_head by **KKI**. */
export function useKeluargaDetail(
  kki: string | null,
  provinsiId?: number | null,
  /** @deprecated tidak dipakai — jangan filter detail by kelurahanId */
  _kelurahanId?: number | null,
) {
  void _kelurahanId;
  const [status, setStatus] = useState<KeluargaDetailStatus>("idle");
  const [payload, setPayload] = useState<KeluargaDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!kki?.trim()) {
      setStatus("idle");
      setPayload(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setPayload(null);
    setError(null);

    // Kirim bentuk dump (14+6spasi) agar URL berisi `++++++`, bukan satu `+`.
    // Server juga me-rebuild pad-6 — aman jika pin hanya punya 1 spasi.
    const kkiForUrl =
      primaryPaddedKki(kki) ?? kki.replace(/^\s+|\s+$/g, "");
    const params = new URLSearchParams({ kki: kkiForUrl });
    if (provinsiId != null && Number.isFinite(provinsiId)) {
      params.set("provinsiId", String(provinsiId));
    }

    void fetch(`/api/keluarga/detail?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const json = (await res.json()) as KeluargaDetailPayload & {
          message?: string;
          error?: string;
          diag?: unknown;
        };
        if (!res.ok) {
          const hint =
            json.message || json.error || `HTTP ${res.status}`;
          throw new Error(hint);
        }
        if (!json?.item) {
          throw new Error(
            "Respons detail keluarga kosong (tanpa item). Periksa DATABASE_URL_VERVAL.",
          );
        }
        setPayload(json);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setPayload(null);
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, [kki, provinsiId, tick]);

  return { status, payload, error, refetch };
}
