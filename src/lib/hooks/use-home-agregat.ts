"use client";

import { useCallback, useSyncExternalStore } from "react";

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

type Snapshot = {
  status: "loading" | "ready" | "error";
  ringkasan: RingkasanPayload | null;
  peringkat: PeringkatProvinsiPayload | null;
  error: string | null;
};

const listeners = new Set<() => void>();

let snapshot: Snapshot = {
  status: "loading",
  ringkasan: null,
  peringkat: null,
  error: null,
};
let generation = 0;
let started = false;

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return snapshot;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      /* ignore non-JSON error body */
    }
    throw new Error(`${detail} (${url})`);
  }
  return (await response.json()) as T;
}

async function load(gen: number) {
  snapshot = {
    status: "loading",
    ringkasan: null,
    peringkat: null,
    error: null,
  };
  emit();

  try {
    const [ringkasanRes, peringkatRes] = await Promise.all([
      fetchJson<RingkasanPayload>("/api/ringkasan?tingkat=nasional"),
      fetchJson<PeringkatProvinsiPayload>("/api/peringkat/provinsi"),
    ]);
    if (gen !== generation) return;
    snapshot = {
      status: "ready",
      ringkasan: ringkasanRes,
      peringkat: peringkatRes,
      error: null,
    };
    emit();
  } catch (err) {
    if (gen !== generation) return;
    snapshot = {
      status: "error",
      ringkasan: null,
      peringkat: null,
      error: err instanceof Error ? err.message : "Gagal memuat agregat",
    };
    emit();
  }
}

function ensureStarted() {
  if (started) return;
  started = true;
  generation = 1;
  void load(1);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ambil agregat home: max 2 request paralel (ringkasan + peringkat).
 * State di-share antar konsumen (header + MapSebaran) agar tidak double-fetch.
 * Tidak memuat by_name / daftar keluarga.
 */
export function useHomeAgregat(): HomeAgregatState {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refetch = useCallback(() => {
    started = true;
    generation += 1;
    void load(generation);
  }, []);

  return {
    status: current.status,
    ringkasan: current.ringkasan,
    peringkat: current.peringkat,
    error: current.error,
    refetch,
  };
}
