"use client";

import { useCallback, useEffect, useState } from "react";

import type { PeringkatKecamatanPayload } from "@/lib/data/types";

export type PeringkatKecamatanState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKecamatanPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking kecamatan dalam kab/kota terpilih.
 * `kabupatenApiId` null → idle.
 */
export function usePeringkatKecamatan(
  kabupatenApiId: string | null,
): PeringkatKecamatanState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<
    Omit<PeringkatKecamatanState, "refetch">
  >({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!kabupatenApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const url = `/api/peringkat/kecamatan?kabupatenId=${encodeURIComponent(kabupatenApiId)}`;
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
        return (await response.json()) as PeringkatKecamatanPayload;
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
              : "Gagal memuat peringkat kecamatan",
        });
      });

    return () => controller.abort();
  }, [kabupatenApiId, tick]);

  return { ...state, refetch };
}
