"use client";

import { useCallback, useEffect, useState } from "react";

import type { PeringkatKelurahanPayload } from "@/lib/data/types";

export type PeringkatKelurahanState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKelurahanPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking desa/kelurahan dalam kecamatan terpilih.
 * `kecamatanApiId` null → idle.
 */
export function usePeringkatKelurahan(
  kecamatanApiId: string | null,
): PeringkatKelurahanState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<
    Omit<PeringkatKelurahanState, "refetch">
  >({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!kecamatanApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const url = `/api/peringkat/kelurahan?kecamatanId=${encodeURIComponent(kecamatanApiId)}`;
    void fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
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
        return (await response.json()) as PeringkatKelurahanPayload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", payload, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          payload: null,
          error:
            err instanceof Error
              ? err.message
              : "Gagal memuat peringkat desa/kelurahan",
        });
      });

    return () => controller.abort();
  }, [kecamatanApiId, tick]);

  return { ...state, refetch };
}
