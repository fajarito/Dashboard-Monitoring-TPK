"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchClientJson,
  peekClientJsonCache,
  peringkatKabupatenUrl,
} from "@/lib/client-api-cache";
import type { PeringkatKabupatenPayload } from "@/lib/data/types";

export type PeringkatKabupatenState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: PeringkatKabupatenPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Ranking kab/kota dalam provinsi terpilih.
 * `provinsiApiId` null → idle. Memory cache 60s + dedupe in-flight.
 */
export function usePeringkatKabupaten(
  provinsiApiId: string | null,
): PeringkatKabupatenState {
  const [tick, setTick] = useState(0);
  const forceNext = useRef(false);
  const [state, setState] = useState<
    Omit<PeringkatKabupatenState, "refetch">
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
    if (!provinsiApiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const url = peringkatKabupatenUrl(provinsiApiId);
    const force = forceNext.current;
    forceNext.current = false;
    const cached = !force
      ? peekClientJsonCache<PeringkatKabupatenPayload>(url)
      : null;
    if (cached) {
      setState({ status: "ready", payload: cached, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    void fetchClientJson<PeringkatKabupatenPayload>(url, {
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
              : "Gagal memuat peringkat kabupaten/kota",
        });
      });

    return () => controller.abort();
  }, [provinsiApiId, tick]);

  return { ...state, refetch };
}
