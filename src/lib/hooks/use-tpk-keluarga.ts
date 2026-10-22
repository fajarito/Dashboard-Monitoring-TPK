"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPayload,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";

export type TpkKeluargaFilters = {
  page: number;
  pageSize?: number;
  prioritas?: TpkKeluargaPrioritas[];
  indikator?: TpkKeluargaIndikatorFilter[];
};

export type TpkKeluargaState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  payload: TpkKeluargaPayload | null;
  error: string | null;
  refetch: () => void;
};

/** Daftar keluarga sasaran TPK (paging server-side, grain kelurahan). */
export function useTpkKeluarga(
  tpkId: string | null | undefined,
  filters: TpkKeluargaFilters,
): TpkKeluargaState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<TpkKeluargaState, "refetch">>({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const page = filters.page;
  const pageSize = filters.pageSize ?? 10;
  const prioritasKey = (filters.prioritas ?? []).join(",");
  const indikatorKey = (filters.indikator ?? []).join(",");

  useEffect(() => {
    const id = tpkId?.trim();
    if (!id) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading", payload: null, error: null });

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (prioritasKey) params.set("prioritas", prioritasKey);
    if (indikatorKey) params.set("indikator", indikatorKey);

    void fetch(
      `/api/tpk/${encodeURIComponent(id)}/keluarga?${params.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    )
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
        const payload = (await response.json()) as TpkKeluargaPayload;
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
            err instanceof Error
              ? err.message
              : "Gagal memuat daftar keluarga",
        });
      });

    return () => controller.abort();
  }, [tpkId, page, pageSize, prioritasKey, indikatorKey, tick]);

  return { ...state, refetch };
}
