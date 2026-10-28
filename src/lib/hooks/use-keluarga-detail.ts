"use client";

import { useCallback, useEffect, useState } from "react";

import type { KeluargaDetailPayload } from "@/lib/data/types";

export type KeluargaDetailStatus = "idle" | "loading" | "ready" | "error";

/** Fetch detail stunting_head by **KKI**. */
export function useKeluargaDetail(kki: string | null, provinsiId?: number | null) {
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
    setError(null);

    const params = new URLSearchParams({
      kki: kki.trim(),
    });
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
        };
        if (!res.ok) {
          throw new Error(json.message || json.error || `HTTP ${res.status}`);
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
