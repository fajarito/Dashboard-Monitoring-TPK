import {
  cacheKey,
  DEFAULT_CACHE_TTL_SEC,
  getCached,
  setCached,
} from "@/lib/data/cache";
import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { getPeringkatProvinsiPostgres } from "@/lib/data/postgres/peringkat";
import { arePostgresPoolsConfigured } from "@/lib/data/postgres/pools";
import { getRingkasanPostgres } from "@/lib/data/postgres/ringkasan";
import type {
  DataSource,
  PeringkatProvinsiPayload,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
} from "@/lib/data/types";

export type {
  DataSource,
  IndikatorRingkasan,
  KomposisiPrioritas,
  KomposisiTPK,
  PeringkatProvinsiItem,
  PeringkatProvinsiPayload,
  RingkasanMeta,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
} from "@/lib/data/types";

export {
  cacheControlHeader,
  DEFAULT_CACHE_TTL_SEC,
} from "@/lib/data/cache";

/** Baca DATA_SOURCE=mock|postgres (default mock). */
export function resolveDataSource(): DataSource {
  const raw = process.env.DATA_SOURCE?.trim().toLowerCase();
  if (raw === "postgres") return "postgres";
  return "mock";
}

function parseTingkat(value: string | null | undefined): RingkasanTingkat {
  return value === "provinsi" ? "provinsi" : "nasional";
}

export function parseRingkasanQuery(
  searchParams: URLSearchParams,
): RingkasanQuery {
  const tingkat = parseTingkat(searchParams.get("tingkat"));
  const id = searchParams.get("id");
  return {
    tingkat,
    id: id && id.trim() ? id.trim() : null,
  };
}

export async function fetchRingkasan(
  query: RingkasanQuery,
): Promise<RingkasanPayload> {
  const source = resolveDataSource();
  const key = cacheKey([
    "ringkasan",
    source,
    query.tingkat,
    query.id ?? "",
  ]);
  const hit = getCached<RingkasanPayload>(key);
  if (hit) return hit;

  let payload: RingkasanPayload;
  if (source === "postgres") {
    // Jika env pool kosong, postgres stub sudah fallback mock.
    payload = await getRingkasanPostgres(query);
  } else {
    payload = getRingkasanMock(query);
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

export async function fetchPeringkatProvinsi(): Promise<PeringkatProvinsiPayload> {
  const source = resolveDataSource();
  const key = cacheKey(["peringkat", "provinsi", source]);
  const hit = getCached<PeringkatProvinsiPayload>(key);
  if (hit) return hit;

  let payload: PeringkatProvinsiPayload;
  if (source === "postgres") {
    payload = await getPeringkatProvinsiPostgres();
  } else {
    payload = getPeringkatProvinsiMock();
  }

  // Jaga batas kontrak: max 40 baris.
  if (payload.items.length > 40) {
    payload = { ...payload, items: payload.items.slice(0, 40) };
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

/** Diagnostik singkat untuk meta / logging (tanpa membuka koneksi). */
export function getDataLayerStatus() {
  return {
    dataSource: resolveDataSource(),
    postgresConfigured: arePostgresPoolsConfigured(),
    cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
  };
}
