"use client";

import { useCallback, useEffect, useState } from "react";

import type { TpkListPayload } from "@/lib/data/types";

export type TpkListFilters = {
  provinsiId: string | null;
  kabupatenId: string | null;
  q: string;
  page: number;
  pageSize?: number;
};

export type TpkListState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: TpkListPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Daftar TPK live/mock dengan paging server-side.
 * Butuh provinsiId dan/atau kabupatenId.
 */
export function useTpkList(filters: TpkListFilters): TpkListState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<TpkListState, "refetch">>({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const provinsiId = filters.provinsiId;
  const kabupatenId = filters.kabupatenId;
  const q = filters.q;
  const page = filters.page;
  const pageSize = filters.pageSize ?? 25;

  useEffect(() => {
    if (!provinsiId && !kabupatenId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const params = new URLSearchParams();
    if (provinsiId) params.set("provinsiId", provinsiId);
    if (kabupatenId) params.set("kabupatenId", kabupatenId);
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    void fetch(`/api/tpk?${params.toString()}`, {
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
        return (await response.json()) as TpkListPayload;
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
            err instanceof Error ? err.message : "Gagal memuat daftar TPK",
        });
      });

    return () => controller.abort();
  }, [provinsiId, kabupatenId, q, page, pageSize, tick]);

  return { ...state, refetch };
}
