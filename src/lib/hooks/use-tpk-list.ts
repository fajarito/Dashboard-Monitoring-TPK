"use client";

import { useCallback, useEffect, useState } from "react";

import type { TpkListPayload, TpkListSort } from "@/lib/data/types";

export type TpkListFilters = {
  provinsiId: string | null;
  kabupatenId: string | null;
  kecamatanId?: string | null;
  kelurahanId?: string | null;
  q: string;
  page: number;
  pageSize?: number;
  sort?: TpkListSort;
};

export type TpkListState = {
  status: "idle" | "loading" | "ready" | "error";
  payload: TpkListPayload | null;
  error: string | null;
  refetch: () => void;
};

/**
 * Daftar TPK live/mock dengan paging server-side.
 * Butuh minimal satu filter wilayah.
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
  const kecamatanId = filters.kecamatanId ?? null;
  const kelurahanId = filters.kelurahanId ?? null;
  const q = filters.q;
  const page = filters.page;
  const pageSize = filters.pageSize ?? 25;
  const sort = filters.sort ?? "krs-desc";

  useEffect(() => {
    if (!provinsiId && !kabupatenId && !kecamatanId && !kelurahanId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const params = new URLSearchParams();
    if (provinsiId) params.set("provinsiId", provinsiId);
    if (kabupatenId) params.set("kabupatenId", kabupatenId);
    if (kecamatanId) params.set("kecamatanId", kecamatanId);
    if (kelurahanId) params.set("kelurahanId", kelurahanId);
    if (q.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sort", sort);

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
  }, [
    provinsiId,
    kabupatenId,
    kecamatanId,
    kelurahanId,
    q,
    page,
    pageSize,
    sort,
    tick,
  ]);

  return { ...state, refetch };
}
