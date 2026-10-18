"use client";

import { useCallback, useEffect, useState } from "react";

import type { RingkasanPayload } from "@/lib/data/types";

export type RingkasanScopeState = {
  status: "idle" | "loading" | "ready" | "error";
  ringkasan: RingkasanPayload | null;
  error: string | null;
  /** id API yang sedang diminta (null = nasional / tanpa filter). */
  provinsiId: string | null;
  refetch: () => void;
};

async function fetchRingkasan(
  url: string,
  signal: AbortSignal,
): Promise<RingkasanPayload> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
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
  return (await response.json()) as RingkasanPayload;
}

/**
 * Ringkasan aktif untuk filter home.
 * - `provinsiId` null → idle (pemakai pakai agregat nasional dari useHomeAgregat).
 * - string → GET /api/ringkasan?tingkat=provinsi&id=…
 */
export function useRingkasanScope(
  provinsiId: string | null,
): RingkasanScopeState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<
    Omit<RingkasanScopeState, "refetch">
  >({
    status: "idle",
    ringkasan: null,
    error: null,
    provinsiId: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!provinsiId) {
      setState({
        status: "idle",
        ringkasan: null,
        error: null,
        provinsiId: null,
      });
      return;
    }

    const controller = new AbortController();
    setState({
      status: "loading",
      ringkasan: null,
      error: null,
      provinsiId,
    });

    const url = `/api/ringkasan?tingkat=provinsi&id=${encodeURIComponent(provinsiId)}`;
    void fetchRingkasan(url, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setState({
          status: "ready",
          ringkasan: payload,
          error: null,
          provinsiId,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          ringkasan: null,
          error:
            err instanceof Error
              ? err.message
              : "Gagal memuat ringkasan provinsi",
          provinsiId,
        });
      });

    return () => controller.abort();
  }, [provinsiId, tick]);

  return { ...state, refetch };
}
