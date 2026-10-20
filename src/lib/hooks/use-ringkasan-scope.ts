"use client";

import { useCallback, useEffect, useState } from "react";

import type { RingkasanPayload, RingkasanTingkat } from "@/lib/data/types";

export type RingkasanScopeInput = {
  /** null = idle (pakai agregat nasional dari useHomeAgregat). */
  tingkat: Extract<
    RingkasanTingkat,
    "provinsi" | "kabupaten" | "kecamatan" | "kelurahan"
  > | null;
  id: string | null;
};

export type RingkasanScopeState = {
  status: "idle" | "loading" | "ready" | "error";
  ringkasan: RingkasanPayload | null;
  error: string | null;
  tingkat: RingkasanScopeInput["tingkat"];
  /** id API yang sedang diminta (null = tanpa filter scoped). */
  id: string | null;
  /** @deprecated alias id untuk kompatibilitas pemanggil lama. */
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
 * - tingkat/id null → idle
 * - provinsi → GET /api/ringkasan?tingkat=provinsi&id=…
 * - kabupaten → GET /api/ringkasan?tingkat=kabupaten&id=…
 * - kecamatan / kelurahan → tingkat yang sama
 *
 * Overload: `useRingkasanScope(provinsiId: string | null)` tetap didukung.
 */
export function useRingkasanScope(
  scopeOrProvinsiId: RingkasanScopeInput | string | null,
): RingkasanScopeState {
  const scope: RingkasanScopeInput =
    typeof scopeOrProvinsiId === "string" || scopeOrProvinsiId === null
      ? {
          tingkat: scopeOrProvinsiId ? "provinsi" : null,
          id: scopeOrProvinsiId,
        }
      : scopeOrProvinsiId;

  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<RingkasanScopeState, "refetch">>({
    status: "idle",
    ringkasan: null,
    error: null,
    tingkat: null,
    id: null,
    provinsiId: null,
  });

  const refetch = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!scope.tingkat || !scope.id) {
      setState({
        status: "idle",
        ringkasan: null,
        error: null,
        tingkat: null,
        id: null,
        provinsiId: null,
      });
      return;
    }

    const controller = new AbortController();
    const tingkat = scope.tingkat;
    const id = scope.id;
    setState({
      status: "loading",
      ringkasan: null,
      error: null,
      tingkat,
      id,
      provinsiId: tingkat === "provinsi" ? id : null,
    });

    const url = `/api/ringkasan?tingkat=${encodeURIComponent(tingkat)}&id=${encodeURIComponent(id)}`;
    void fetchRingkasan(url, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setState({
          status: "ready",
          ringkasan: payload,
          error: null,
          tingkat,
          id,
          provinsiId: tingkat === "provinsi" ? id : null,
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
              : tingkat === "kelurahan"
                ? "Gagal memuat ringkasan desa/kelurahan"
                : tingkat === "kecamatan"
                  ? "Gagal memuat ringkasan kecamatan"
                  : tingkat === "kabupaten"
                    ? "Gagal memuat ringkasan kabupaten/kota"
                    : "Gagal memuat ringkasan provinsi",
          tingkat,
          id,
          provinsiId: tingkat === "provinsi" ? id : null,
        });
      });

    return () => controller.abort();
  }, [scope.tingkat, scope.id, tick]);

  return { ...state, refetch };
}
