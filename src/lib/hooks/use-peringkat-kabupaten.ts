"use client";

import { useCallback, useEffect, useState } from "react";

import type { PeringkatKabupatenPayload } from "@/lib/data/types";

export type PeringkatKabupatenState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKabupatenPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking kab/kota dalam provinsi terpilih.
 * `provinsiApiId` null → idle.
 */
export function usePeringkatKabupaten(
  provinsiApiId: string | null,
): PeringkatKabupatenState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<
    Omit<PeringkatKabupatenState, "refetch">
  >({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!provinsiApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const url = `/api/peringkat/kabupaten?provinsiId=${encodeURIComponent(provinsiApiId)}`;
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
        return (await response.json()) as PeringkatKabupatenPayload;
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
              : "Gagal memuat peringkat kabupaten/kota",
        });
      });

    return () => controller.abort();
  }, [provinsiApiId, tick]);

  return { ...state, refetch };
}
