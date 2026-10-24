/**
 * Cache fetch JSON di browser — selaras TTL API 60s.
 * - Dedup in-flight (banyak hook/komponen share 1 request)
 * - Memory hit → tanpa network
 * - Fetch tanpa `cache: "no-store"` agar header Cache-Control API dipakai
 */

import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";

type Entry<T> = {
  value?: T;
  expiresAt: number;
  inflight?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();
const TTL_MS = DEFAULT_CACHE_TTL_SEC * 1000;

function isFresh<T>(entry: Entry<T> | undefined): entry is Entry<T> & { value: T } {
  return Boolean(
    entry &&
      entry.value !== undefined &&
      Date.now() < entry.expiresAt,
  );
}

/** Baca cache memory tanpa network (null jika miss/expired). */
export function peekClientJsonCache<T>(url: string): T | null {
  const entry = store.get(url) as Entry<T> | undefined;
  if (!isFresh(entry)) return null;
  return entry.value;
}

/**
 * GET JSON dengan memory cache 60s + dedupe in-flight.
 * `force: true` mengabaikan memory (tetap dedupe bila ada inflight).
 */
export async function fetchClientJson<T>(
  url: string,
  options?: { signal?: AbortSignal; force?: boolean },
): Promise<T> {
  const existing = store.get(url) as Entry<T> | undefined;

  if (!options?.force && isFresh(existing)) {
    return existing.value;
  }

  if (existing?.inflight) {
    return existing.inflight;
  }

  const inflight = (async () => {
    // Tanpa signal bersama — abort di satu komponen tidak batalkan prefetch/hook lain.
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) detail = body.message;
      } catch {
        /* ignore */
      }
      throw new Error(`${detail} (${url})`);
    }
    return (await response.json()) as T;
  })();

  store.set(url, {
    value: existing?.value,
    expiresAt: existing?.expiresAt ?? 0,
    inflight,
  });

  const wait = (async () => {
    try {
      const value = await inflight;
      store.set(url, {
        value,
        expiresAt: Date.now() + TTL_MS,
      });
      return value;
    } catch (err) {
      const cur = store.get(url) as Entry<T> | undefined;
      if (cur?.inflight === inflight) {
        if (cur.value !== undefined && Date.now() < cur.expiresAt) {
          store.set(url, { value: cur.value, expiresAt: cur.expiresAt });
        } else {
          store.delete(url);
        }
      }
      throw err;
    }
  })();

  const signal = options?.signal;
  if (!signal) return wait;

  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () =>
      reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    wait.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/** Prefetch diam — gagal diabaikan. */
export function prefetchClientJson(url: string): void {
  if (typeof window === "undefined") return;
  if (peekClientJsonCache(url)) return;
  void fetchClientJson(url).catch(() => {
    /* prefetch best-effort */
  });
}

export const HOME_RINGKASAN_URL = "/api/ringkasan?tingkat=nasional";
export const HOME_PERINGKAT_URL = "/api/peringkat/provinsi";

export function peringkatKabupatenUrl(provinsiApiId: string): string {
  return `/api/peringkat/kabupaten?provinsiId=${encodeURIComponent(provinsiApiId)}`;
}

export function peringkatKecamatanUrl(kabupatenApiId: string): string {
  return `/api/peringkat/kecamatan?kabupatenId=${encodeURIComponent(kabupatenApiId)}`;
}

export function peringkatKelurahanUrl(kecamatanApiId: string): string {
  return `/api/peringkat/kelurahan?kecamatanId=${encodeURIComponent(kecamatanApiId)}`;
}

export function ringkasanScopeUrl(
  tingkat: string,
  id: string,
): string {
  return `/api/ringkasan?tingkat=${encodeURIComponent(tingkat)}&id=${encodeURIComponent(id)}`;
}

/** Prefetch agregat home (ringkasan + peringkat) paralel. */
export function prefetchHomeAgregat(): void {
  prefetchClientJson(HOME_RINGKASAN_URL);
  prefetchClientJson(HOME_PERINGKAT_URL);
}

export function prefetchPeringkatKabupaten(provinsiApiId: string): void {
  if (!provinsiApiId) return;
  prefetchClientJson(peringkatKabupatenUrl(provinsiApiId));
}

export function prefetchPeringkatKecamatan(kabupatenApiId: string): void {
  if (!kabupatenApiId) return;
  prefetchClientJson(peringkatKecamatanUrl(kabupatenApiId));
}

export function prefetchPeringkatKelurahan(kecamatanApiId: string): void {
  if (!kecamatanApiId) return;
  prefetchClientJson(peringkatKelurahanUrl(kecamatanApiId));
}

/** Preload script widget Master Wilayah (paralel dengan fetch peringkat). */
export function prefetchMasterWilayahWidget(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const raw = process.env.NEXT_PUBLIC_MASTER_WILAYAH_API_URL?.trim();
  if (!raw) return;
  const base = raw.replace(/\/+$/, "");
  const src = `${base}/map/widget.js`;
  if (document.querySelector(`link[rel="preload"][href="${src}"]`)) return;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = src;
  document.head.appendChild(link);
}
