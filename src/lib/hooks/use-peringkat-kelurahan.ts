"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchClientJson,
  peekClientJsonCache,
  peringkatKelurahanUrl,
} from "@/lib/client-api-cache";
import type { PeringkatKelurahanPayload } from "@/lib/data/types";

export type PeringkatKelurahanState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKelurahanPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking desa/kelurahan dalam kecamatan terpilih.
 * `kecamatanApiId` null → idle. Memory cache 60s + dedupe in-flight.
 */
export function usePeringkatKelurahan(
  kecamatanApiId: string | null,
): PeringkatKelurahanState {
  const [tick, setTick] = useState(0);
  const forceNext = useRef(false);
  const [state, setState] = useState<
    Omit<PeringkatKelurahanState, "refetch">
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
    if (!kecamatanApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const url = peringkatKelurahanUrl(kecamatanApiId);
    const force = forceNext.current;
    forceNext.current = false;
    const cached = !force
      ? peekClientJsonCache<PeringkatKelurahanPayload>(url)
      : null;
    if (cached) {
      setState({ status: "ready", payload: cached, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    void fetchClientJson<PeringkatKelurahanPayload>(url, {
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
              : "Gagal memuat peringkat desa/kelurahan",
        });
      });

    return () => controller.abort();
  }, [kecamatanApiId, tick]);

  return { ...state, refetch };
}
