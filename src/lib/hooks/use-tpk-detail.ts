"use client";

import { useCallback, useEffect, useState } from "react";

import type { TpkDetailPayload } from "@/lib/data/types";

export type TpkDetailState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  payload: TpkDetailPayload | null;
  error: string | null;
  refetch: () => void;
};

/** Detail TPK live/mock by TPKID. */
export function useTpkDetail(tpkId: string | null | undefined): TpkDetailState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<TpkDetailState, "refetch">>({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const id = tpkId?.trim();
    if (!id) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    void fetch(`/api/tpk/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          return { kind: "empty" as const };
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
        const payload = (await response.json()) as TpkDetailPayload;
        return { kind: "ready" as const, payload };
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.kind === "empty") {
          setState({ status: "empty", payload: null, error: null });
          return;
        }
        setState({ status: "ready", payload: result.payload, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          payload: null,
          error:
            err instanceof Error ? err.message : "Gagal memuat detail TPK",
        });
      });

    return () => controller.abort();
  }, [tpkId, tick]);

  return { ...state, refetch };
}
