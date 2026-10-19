import {
  cacheKey,
  DEFAULT_CACHE_TTL_SEC,
  getCached,
  setCached,
} from "@/lib/data/cache";
import { getPeringkatKabupatenMock } from "@/lib/data/mock/peringkat-kabupaten";
import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { getTpkListMock } from "@/lib/data/mock/tpk-list";
import { getPeringkatKabupatenPostgres } from "@/lib/data/postgres/peringkat-kabupaten";
import { getPeringkatProvinsiPostgres } from "@/lib/data/postgres/peringkat";
import {
  arePostgresPoolsConfigured,
  getPoolConfigs,
} from "@/lib/data/postgres/pools";
import { getRingkasanPostgres } from "@/lib/data/postgres/ringkasan";
import { getTpkListPostgres } from "@/lib/data/postgres/tpk-list";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import type {
  DataSource,
  PeringkatKabupatenPayload,
  PeringkatProvinsiPayload,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
  TpkListPayload,
  TpkListQuery,
  TpkListSort,
} from "@/lib/data/types";

export type {
  DataSource,
  IndikatorRingkasan,
  KomposisiPrioritas,
  KomposisiTPK,
  PeringkatKabupatenItem,
  PeringkatKabupatenPayload,
  PeringkatProvinsiItem,
  PeringkatProvinsiPayload,
  RingkasanMeta,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
  TpkListIndikator,
  TpkListItem,
  TpkListPayload,
  TpkListPkb,
  TpkListQuery,
  TpkListSort,
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
  const raw = value?.trim().toLowerCase();
  if (raw === "provinsi") return "provinsi";
  if (raw === "kabupaten" || raw === "kab") return "kabupaten";
  return "nasional";
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

const TPK_SORT_VALUES: readonly TpkListSort[] = [
  "nama",
  "krs-desc",
  "krs-asc",
  "ibuHamil-desc",
  "baduta-desc",
  "balita-desc",
  "rtlh-desc",
] as const;

function parseTpkListSort(raw: string | null): TpkListSort {
  const value = raw?.trim() as TpkListSort | undefined;
  if (value && (TPK_SORT_VALUES as readonly string[]).includes(value)) {
    return value;
  }
  return "krs-desc";
}

export function parseTpkListQuery(searchParams: URLSearchParams): TpkListQuery {
  const parseOptionalInt = (key: string): number | null => {
    const raw = searchParams.get(key)?.trim();
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new PostgresDataError(
        `invalid_${key}`,
        `Parameter ${key} tidak valid: "${raw}".`,
        { status: 400 },
      );
    }
    return n;
  };

  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");
  let page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  let pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 25;
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 25;
  pageSize = Math.min(50, Math.max(10, pageSize));

  const q = searchParams.get("q")?.trim() || null;

  return {
    provinsiId: parseOptionalInt("provinsiId"),
    kabupatenId: parseOptionalInt("kabupatenId"),
    q,
    page,
    pageSize,
    sort: parseTpkListSort(searchParams.get("sort")),
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

  if (payload.items.length > 40) {
    payload = { ...payload, items: payload.items.slice(0, 40) };
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

export async function fetchPeringkatKabupaten(
  provinsiId: string,
): Promise<PeringkatKabupatenPayload> {
  const source = resolveDataSource();
  const key = cacheKey(["peringkat", "kabupaten", source, provinsiId]);
  const hit = getCached<PeringkatKabupatenPayload>(key);
  if (hit) return hit;

  let payload: PeringkatKabupatenPayload;
  if (source === "postgres") {
    payload = await getPeringkatKabupatenPostgres(provinsiId);
  } else {
    payload = getPeringkatKabupatenMock(provinsiId);
  }

  if (payload.items.length > 80) {
    payload = { ...payload, items: payload.items.slice(0, 80) };
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

/**
 * Daftar TPK paging — cache singkat per filter+page.
 * Tidak memakai by_name DWH.
 */
export async function fetchTpkList(
  query: TpkListQuery,
): Promise<TpkListPayload> {
  if (query.provinsiId == null && query.kabupatenId == null) {
    throw new PostgresDataError(
      "missing_wilayah_filter",
      "Daftar TPK membutuhkan provinsiId dan/atau kabupatenId.",
      { status: 400 },
    );
  }

  const source = resolveDataSource();
  const key = cacheKey([
    "tpk-list",
    source,
    query.provinsiId ?? "",
    query.kabupatenId ?? "",
    query.q ?? "",
    query.sort,
    query.page,
    query.pageSize,
  ]);
  const hit = getCached<TpkListPayload>(key);
  if (hit) return hit;

  let payload: TpkListPayload;
  if (source === "postgres") {
    payload = await getTpkListPostgres(query);
  } else {
    payload = getTpkListMock(query);
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

/** Diagnostik singkat untuk meta / logging (tanpa membuka koneksi). */
export function getDataLayerStatus() {
  return {
    dataSource: resolveDataSource(),
    postgresConfigured: arePostgresPoolsConfigured(),
    sigaConfigured: getPoolConfigs().siga.ready,
    cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
  };
}
