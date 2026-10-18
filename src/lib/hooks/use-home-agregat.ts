"use client";

import { useCallback, useEffect, useState } from "react";

import type {
  PeringkatProvinsiPayload,
  RingkasanPayload,
} from "@/lib/data/types";

export type HomeAgregatState = {
  status: "loading" | "ready" | "error";
  ringkasan: RingkasanPayload | null;
  peringkat: PeringkatProvinsiPayload | null;
  error: string | null;
  refetch: () => void;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} untuk ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * Ambil agregat home: max 2 request paralel (ringkasan + peringkat).
 * Tidak memuat by_name / daftar keluarga.
 */
export function useHomeAgregat(): HomeAgregatState {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [ringkasan, setRingkasan] = useState<RingkasanPayload | null>(null);
  const [peringkat, setPeringkat] = useState<PeringkatProvinsiPayload | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    (async () => {
      try {
        const [ringkasanRes, peringkatRes] = await Promise.all([
          fetchJson<RingkasanPayload>("/api/ringkasan?tingkat=nasional"),
          fetchJson<PeringkatProvinsiPayload>("/api/peringkat/provinsi"),
        ]);
        if (cancelled) return;
        setRingkasan(ringkasanRes);
        setPeringkat(peringkatRes);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setRingkasan(null);
        setPeringkat(null);
        setError(err instanceof Error ? err.message : "Gagal memuat agregat");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { status, ringkasan, peringkat, error, refetch };
}
