"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchClientJson,
  peekClientJsonCache,
  peringkatKecamatanUrl,
} from "@/lib/client-api-cache";
import type { PeringkatKecamatanPayload } from "@/lib/data/types";

export type PeringkatKecamatanState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKecamatanPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking kecamatan dalam kab/kota terpilih.
 * `kabupatenApiId` null → idle. Memory cache 60s + dedupe in-flight.
 */
export function usePeringkatKecamatan(
  kabupatenApiId: string | null,
): PeringkatKecamatanState {
  const [tick, setTick] = useState(0);
  const forceNext = useRef(false);
  const [state, setState] = useState<
    Omit<PeringkatKecamatanState, "refetch">
  >({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    forceNext.current = true;
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!kabupatenApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const url = peringkatKecamatanUrl(kabupatenApiId);
    const force = forceNext.current;
    forceNext.current = false;
    const cached = !force
      ? peekClientJsonCache<PeringkatKecamatanPayload>(url)
      : null;
    if (cached) {
      setState({ status: "ready", payload: cached, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    void fetchClientJson<PeringkatKecamatanPayload>(url, {
      signal: controller.signal,
      force,
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
