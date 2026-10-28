"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  KrsPointsPayload,
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPrioritas,
} from "@/lib/data/types";

export type KrsPointsFilters = {
  kelurahanId: string | null | undefined;
  provinsiId: string | null | undefined;
  /** false = jangan fetch (mis. level bukan desa). */
  enabled?: boolean;
  prioritas?: TpkKeluargaPrioritas[];
  indikator?: TpkKeluargaIndikatorFilter[];
  validCoordsOnly?: boolean;
  q?: string;
  limit?: number;
};

export type KrsPointsState = {
  status: "idle" | "loading" | "ready" | "empty" | "error";
  payload: KrsPointsPayload | null;
  error: string | null;
  refetch: () => void;
};

/** Pin KRS kelurahan — async, tidak memblok choropleth. */
export function useKrsPoints(filters: KrsPointsFilters): KrsPointsState {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<KrsPointsState, "refetch">>({
    status: "idle",
    payload: null,
    error: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  const enabled = filters.enabled !== false;
  const kelurahanId = filters.kelurahanId?.trim() ?? "";
  const provinsiId = filters.provinsiId?.trim() ?? "";
  const prioritasKey = (filters.prioritas ?? []).join(",");
  const indikatorKey = (filters.indikator ?? ["krs"]).join(",");
  const validCoordsOnly = filters.validCoordsOnly !== false;
  const q = filters.q?.trim() ?? "";
  const limit = filters.limit ?? 1000;

  useEffect(() => {
    if (!enabled || !kelurahanId || !provinsiId) {
      setState({ status: "idle", payload: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState((prev) => ({
      status: "loading",
      // Pertahankan pin lama saat refetch agar choropleth tidak "flash".
      payload: prev.payload,
      error: null,
    }));

    const params = new URLSearchParams();
    params.set("kelurahanId", kelurahanId);
    params.set("provinsiId", provinsiId);
    params.set("limit", String(limit));
    params.set("validCoordsOnly", validCoordsOnly ? "true" : "false");
    if (prioritasKey) params.set("prioritas", prioritasKey);
    // Selalu kirim indikator (bisa kosong) agar default API "krs" tidak
    // menimpa pilihan user yang sengaja mengosongkan chip.
    params.set("indikator", indikatorKey);
    if (q.length >= 2) params.set("q", q);

    void fetch(`/api/keluarga/points?${params.toString()}`, {
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
        return (await response.json()) as KrsPointsPayload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        if (!payload.items?.length) {
          setState({ status: "empty", payload, error: null });
          return;
        }
        setState({ status: "ready", payload, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          payload: null,
          error:
            err instanceof Error ? err.message : "Gagal memuat pin KRS",
        });
      });

    return () => controller.abort();
  }, [
    enabled,
    kelurahanId,
    provinsiId,
    prioritasKey,
    indikatorKey,
    validCoordsOnly,
    q,
    limit,
    tick,
  ]);

  return { ...state, refetch };
}
