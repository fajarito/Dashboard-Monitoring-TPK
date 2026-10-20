import {
  cacheKey,
  DEFAULT_CACHE_TTL_SEC,
  getCached,
  setCached,
} from "@/lib/data/cache";
import { getPeringkatKabupatenMock } from "@/lib/data/mock/peringkat-kabupaten";
import { getPeringkatKecamatanMock } from "@/lib/data/mock/peringkat-kecamatan";
import { getPeringkatKelurahanMock } from "@/lib/data/mock/peringkat-kelurahan";
import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { getTpkDetailMock } from "@/lib/data/mock/tpk-detail";
import { getTpkListMock } from "@/lib/data/mock/tpk-list";
import { getPeringkatKabupatenPostgres } from "@/lib/data/postgres/peringkat-kabupaten";
import { getPeringkatKecamatanPostgres } from "@/lib/data/postgres/peringkat-kecamatan";
import { getPeringkatKelurahanPostgres } from "@/lib/data/postgres/peringkat-kelurahan";
import { getPeringkatProvinsiPostgres } from "@/lib/data/postgres/peringkat";
import {
  arePostgresPoolsConfigured,
  getPoolConfigs,
} from "@/lib/data/postgres/pools";
import { getRingkasanPostgres } from "@/lib/data/postgres/ringkasan";
import { getTpkDetailPostgres } from "@/lib/data/postgres/tpk-detail";
import { getTpkListPostgres } from "@/lib/data/postgres/tpk-list";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import type {
  DataSource,
  PeringkatKabupatenPayload,
  PeringkatKecamatanPayload,
  PeringkatKelurahanPayload,
  PeringkatProvinsiPayload,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
  TpkDetailPayload,
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
  PeringkatKecamatanItem,
  PeringkatKecamatanPayload,
  PeringkatKelurahanItem,
  PeringkatKelurahanPayload,
  PeringkatProvinsiItem,
  PeringkatProvinsiPayload,
  RingkasanMeta,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
  TpkDetailAnggota,
  TpkDetailKomposisiPrioritas,
  TpkDetailPayload,
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
  if (raw === "kecamatan" || raw === "kec") return "kecamatan";
  if (raw === "kelurahan" || raw === "kel" || raw === "desa") return "kelurahan";
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
    kecamatanId: parseOptionalInt("kecamatanId"),
    kelurahanId: parseOptionalInt("kelurahanId"),
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

export async function fetchPeringkatKecamatan(
  kabupatenId: string,
): Promise<PeringkatKecamatanPayload> {
  const source = resolveDataSource();
  const key = cacheKey(["peringkat", "kecamatan", source, kabupatenId]);
  const hit = getCached<PeringkatKecamatanPayload>(key);
  if (hit) return hit;

  let payload: PeringkatKecamatanPayload;
  if (source === "postgres") {
    payload = await getPeringkatKecamatanPostgres(kabupatenId);
  } else {
    payload = getPeringkatKecamatanMock(kabupatenId);
  }

  if (payload.items.length > 120) {
    payload = { ...payload, items: payload.items.slice(0, 120) };
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

export async function fetchPeringkatKelurahan(
  kecamatanId: string,
): Promise<PeringkatKelurahanPayload> {
  const source = resolveDataSource();
  const key = cacheKey(["peringkat", "kelurahan", source, kecamatanId]);
  const hit = getCached<PeringkatKelurahanPayload>(key);
  if (hit) return hit;

  let payload: PeringkatKelurahanPayload;
  if (source === "postgres") {
    payload = await getPeringkatKelurahanPostgres(kecamatanId);
  } else {
    payload = getPeringkatKelurahanMock(kecamatanId);
  }

  if (payload.items.length > 200) {
    payload = { ...payload, items: payload.items.slice(0, 200) };
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
  if (
    query.provinsiId == null &&
    query.kabupatenId == null &&
    query.kecamatanId == null &&
    query.kelurahanId == null
  ) {
    throw new PostgresDataError(
      "missing_wilayah_filter",
      "Daftar TPK membutuhkan provinsiId, kabupatenId, kecamatanId, dan/atau kelurahanId.",
      { status: 400 },
    );
  }

  const source = resolveDataSource();
  const key = cacheKey([
    "tpk-list",
    source,
    query.provinsiId ?? "",
    query.kabupatenId ?? "",
    query.kecamatanId ?? "",
    query.kelurahanId ?? "",
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

/**
 * Detail satu TPK — cache 60 dtk.
 * Tidak memakai by_name DWH; sasaran/KRS dari rollup kelurahan.
 * null → TPK tidak ditemukan.
 */
export async function fetchTpkDetail(
  tpkId: string,
): Promise<TpkDetailPayload | null> {
  const id = tpkId.trim();
  if (!id) {
    throw new PostgresDataError("invalid_tpk_id", "TPKID tidak valid.", {
      status: 400,
    });
  }

  const source = resolveDataSource();
  const key = cacheKey(["tpk-detail", source, id]);
  const hit = getCached<TpkDetailPayload | { __missing: true }>(key);
  if (hit) {
    if ("__missing" in hit) return null;
    return hit;
  }

  let payload: TpkDetailPayload | null;
  if (source === "postgres") {
    payload = await getTpkDetailPostgres(id);
  } else {
    payload = getTpkDetailMock(id);
  }

  if (!payload) {
    setCached(key, { __missing: true }, DEFAULT_CACHE_TTL_SEC);
    return null;
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
