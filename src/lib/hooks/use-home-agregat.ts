"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  fetchClientJson,
  HOME_PERINGKAT_URL,
  HOME_RINGKASAN_URL,
  peekClientJsonCache,
  prefetchHomeAgregat,
} from "@/lib/client-api-cache";
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

/** Frozen server snapshot — never mutate; keeps SSR HTML identical across requests. */
const SERVER_SNAPSHOT: Snapshot = {
  status: "loading",
  ringkasan: null,
  peringkat: null,
  error: null,
};

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

async function load(gen: number, force: boolean) {
  const cachedRing = peekClientJsonCache<RingkasanPayload>(HOME_RINGKASAN_URL);
  const cachedPer = peekClientJsonCache<PeringkatProvinsiPayload>(
    HOME_PERINGKAT_URL,
  );

  // Memory hit 60s → langsung ready, tanpa flash loading / network.
  if (!force && cachedRing && cachedPer) {
    if (gen !== generation) return;
    snapshot = {
      status: "ready",
      ringkasan: cachedRing,
      peringkat: cachedPer,
      error: null,
    };
    emit();
    return;
  }

  // Ada cache parsial → tampilkan sambil refresh (hindari overlay lama).
  if (!force && (cachedRing || cachedPer) && snapshot.status !== "ready") {
    snapshot = {
      status: "loading",
      ringkasan: cachedRing,
      peringkat: cachedPer,
      error: null,
    };
    emit();
  } else if (snapshot.status !== "ready") {
    snapshot = {
      status: "loading",
      ringkasan: null,
      peringkat: null,
      error: null,
    };
    emit();
  }

  try {
    const [ringkasanRes, peringkatRes] = await Promise.all([
      fetchClientJson<RingkasanPayload>(HOME_RINGKASAN_URL, { force }),
      fetchClientJson<PeringkatProvinsiPayload>(HOME_PERINGKAT_URL, { force }),
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
    // Pertahankan data cache bila ada agar peta tidak blank.
    if (cachedRing || cachedPer) {
      snapshot = {
        status: "ready",
        ringkasan: cachedRing,
        peringkat: cachedPer,
        error: null,
      };
      emit();
      return;
    }
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
  void load(1, false);
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
 * Cache memory 60s selaras API — tidak memuat by_name / daftar keluarga.
 */
export function useHomeAgregat(): HomeAgregatState {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const refetch = useCallback(() => {
    started = true;
    generation += 1;
    void load(generation, true);
  }, []);

  return {
    status: current.status,
    ringkasan: current.ringkasan,
    peringkat: current.peringkat,
    error: current.error,
    refetch,
  };
}

/** Mulai fetch home sedini mungkin (paralel widget MW), sebelum map mount. */
export function prefetchHomeAgregatEarly(): void {
  prefetchHomeAgregat();
  ensureStarted();
}

// Client bundle: kickoff paralel dengan hidrasi (bukan waterfall setelah map).
if (typeof window !== "undefined") {
  prefetchHomeAgregatEarly();
}
