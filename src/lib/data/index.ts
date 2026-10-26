import {
  cacheKey,
  DEFAULT_CACHE_TTL_SEC,
  getCached,
  getOrLoadCached,
  setCached,
} from "@/lib/data/cache";
import { getPeringkatKabupatenMock } from "@/lib/data/mock/peringkat-kabupaten";
import { getPeringkatKecamatanMock } from "@/lib/data/mock/peringkat-kecamatan";
import { getPeringkatKelurahanMock } from "@/lib/data/mock/peringkat-kelurahan";
import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { getTpkDetailMock } from "@/lib/data/mock/tpk-detail";
import { getKrsPointsMock } from "@/lib/data/mock/krs-points";
import { getTpkKeluargaMock } from "@/lib/data/mock/tpk-keluarga";
import { getTpkListMock } from "@/lib/data/mock/tpk-list";
import { getKrsPointsPostgres } from "@/lib/data/postgres/krs-points";
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
import { getTpkKeluargaPostgres } from "@/lib/data/postgres/tpk-keluarga";
import { getTpkListPostgres } from "@/lib/data/postgres/tpk-list";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import type {
  DataSource,
  KrsPointsBbox,
  KrsPointsPayload,
  KrsPointsQuery,
  PeringkatKabupatenPayload,
  PeringkatKecamatanPayload,
  PeringkatKelurahanPayload,
  PeringkatProvinsiPayload,
  RingkasanPayload,
  RingkasanQuery,
  RingkasanTingkat,
  TpkDetailPayload,
  TpkKeluargaIndikatorFilter,
  TpkKeluargaPayload,
  TpkKeluargaPrioritas,
  TpkKeluargaQuery,
  TpkListPayload,
  TpkListQuery,
  TpkListSort,
} from "@/lib/data/types";
import {
  KRS_POINTS_DEFAULT_LIMIT,
  KRS_POINTS_HARD_MAX,
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
  KrsPointItem,
  KrsPointsBbox,
  KrsPointsPayload,
  KrsPointsQuery,
  TpkKeluargaIndikatorFilter,
  TpkKeluargaItem,
  TpkKeluargaPayload,
  TpkKeluargaPrioritas,
  TpkKeluargaQuery,
  TpkListIndikator,
  TpkListItem,
  TpkListPayload,
  TpkListPkb,
  TpkListQuery,
  TpkListSort,
} from "@/lib/data/types";

export {
  KRS_POINTS_DEFAULT_LIMIT,
  KRS_POINTS_HARD_MAX,
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

/**
 * DATA_SOURCE=postgres wajib punya triple-pool URL.
 * Jangan diam-diam serve mock (KPI live + peta mock = data palsu).
 */
function assertPostgresReady(): void {
  if (!arePostgresPoolsConfigured()) {
    throw new PostgresDataError(
      "postgres_not_configured",
      "DATA_SOURCE=postgres tetapi DATABASE_URL_SIGA / DATABASE_URL_WILAYAH / DATABASE_URL_DWH belum di-set. Isi ketiga URL atau set DATA_SOURCE=mock.",
    );
  }
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
  // Typeahead memakai 8–10; list default 25 (maks 50).
  pageSize = Math.min(50, Math.max(8, pageSize));

  const qRaw = searchParams.get("q")?.trim() || null;
  const q = qRaw && qRaw.length >= 2 ? qRaw : null;

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
  return getOrLoadCached(key, async () => {
    if (source === "postgres") {
      assertPostgresReady();
      return getRingkasanPostgres(query);
    }
    return getRingkasanMock(query);
  }, DEFAULT_CACHE_TTL_SEC);
}

export async function fetchPeringkatProvinsi(): Promise<PeringkatProvinsiPayload> {
  const source = resolveDataSource();
  const key = cacheKey(["peringkat", "provinsi", source]);
  return getOrLoadCached(key, async () => {
    let payload: PeringkatProvinsiPayload;
    if (source === "postgres") {
      assertPostgresReady();
      payload = await getPeringkatProvinsiPostgres();
    } else {
      payload = getPeringkatProvinsiMock();
    }
    if (payload.items.length > 40) {
      payload = { ...payload, items: payload.items.slice(0, 40) };
    }
    return payload;
  }, DEFAULT_CACHE_TTL_SEC);
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
    assertPostgresReady();
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
    assertPostgresReady();
    payload = await getPeringkatKecamatanPostgres(kabupatenId);
  } else {
    payload = await getPeringkatKecamatanMock(kabupatenId);
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
    assertPostgresReady();
    payload = await getPeringkatKelurahanPostgres(kecamatanId);
  } else {
    payload = await getPeringkatKelurahanMock(kecamatanId);
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
    assertPostgresReady();
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
    assertPostgresReady();
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

const PRIORITAS_VALUES: readonly TpkKeluargaPrioritas[] = [
  "p1",
  "p2",
  "p3",
  "p4",
  "bukan",
  "tidakRisiko",
] as const;

const INDIKATOR_FILTER_VALUES: readonly TpkKeluargaIndikatorFilter[] = [
  "ibuHamil",
  "baduta",
  "balita",
  "jambanTidakLayak",
  "sumberAirTidakLayak",
  "krs",
] as const;

function parseCsvParam<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] {
  if (!raw?.trim()) return [];
  const allowedSet = new Set<string>(allowed);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!value || seen.has(value) || !allowedSet.has(value)) continue;
    seen.add(value);
    out.push(value as T);
  }
  return out;
}

/** Query daftar keluarga TPK — page 1..n, pageSize 5–50 (default 10). */
export function parseTpkKeluargaQuery(
  searchParams: URLSearchParams,
): TpkKeluargaQuery {
  const pageRaw = searchParams.get("page");
  const pageSizeRaw = searchParams.get("pageSize");
  let page = pageRaw ? Number.parseInt(pageRaw, 10) : 1;
  let pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : 10;
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 10;
  pageSize = Math.min(50, Math.max(5, pageSize));

  return {
    page,
    pageSize,
    prioritas: parseCsvParam(searchParams.get("prioritas"), PRIORITAS_VALUES),
    indikator: parseCsvParam(
      searchParams.get("indikator"),
      INDIKATOR_FILTER_VALUES,
    ),
  };
}

/**
 * Daftar keluarga sasaran se-kelurahan TPK — by_name paging, cache 60 dtk.
 * Scope kelurahan (+ id_provinsi prune); bukan dump nasional.
 * null → TPK tidak ditemukan.
 */
export async function fetchTpkKeluarga(
  tpkId: string,
  query: TpkKeluargaQuery,
): Promise<TpkKeluargaPayload | null> {
  const id = tpkId.trim();
  if (!id) {
    throw new PostgresDataError("invalid_tpk_id", "TPKID tidak valid.", {
      status: 400,
    });
  }

  const source = resolveDataSource();
  const key = cacheKey([
    "tpk-keluarga",
    source,
    id,
    query.page,
    query.pageSize,
    query.prioritas.join("|"),
    query.indikator.join("|"),
  ]);
  const hit = getCached<TpkKeluargaPayload | { __missing: true }>(key);
  if (hit) {
    if ("__missing" in hit) return null;
    return hit;
  }

  let payload: TpkKeluargaPayload | null;
  if (source === "postgres") {
    assertPostgresReady();
    payload = await getTpkKeluargaPostgres(id, query);
  } else {
    payload = getTpkKeluargaMock(id, query);
  }

  if (!payload) {
    setCached(key, { __missing: true }, DEFAULT_CACHE_TTL_SEC);
    return null;
  }

  return setCached(key, payload, DEFAULT_CACHE_TTL_SEC);
}

function parsePositiveIntParam(
  raw: string | null,
  label: string,
): number {
  const n = raw?.trim() ? Number.parseInt(raw.trim(), 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) {
    throw new PostgresDataError(
      "invalid_query",
      `${label} wajib angka positif.`,
      { status: 400 },
    );
  }
  return n;
}

function parseBboxParam(raw: string | null): KrsPointsBbox | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new PostgresDataError(
      "invalid_bbox",
      "bbox harus west,south,east,north (4 angka).",
      { status: 400 },
    );
  }
  const [west, south, east, north] = parts as [
    number,
    number,
    number,
    number,
  ];
  if (west >= east || south >= north) {
    throw new PostgresDataError(
      "invalid_bbox",
      "bbox: west < east dan south < north.",
      { status: 400 },
    );
  }
  return { west, south, east, north };
}

function parseBoolParam(raw: string | null, defaultValue: boolean): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "ya") return true;
  if (v === "0" || v === "false" || v === "tidak") return false;
  return defaultValue;
}

/**
 * Query pin KRS kelurahan.
 * Default: indikator=krs, validCoordsOnly=true, limit=1000 (max 2000).
 */
export function parseKrsPointsQuery(
  searchParams: URLSearchParams,
): KrsPointsQuery {
  const kelurahanId = parsePositiveIntParam(
    searchParams.get("kelurahanId"),
    "kelurahanId",
  );
  const provinsiId = parsePositiveIntParam(
    searchParams.get("provinsiId"),
    "provinsiId",
  );

  let limit = searchParams.get("limit")
    ? Number.parseInt(searchParams.get("limit")!, 10)
    : KRS_POINTS_DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) limit = KRS_POINTS_DEFAULT_LIMIT;
  limit = Math.min(KRS_POINTS_HARD_MAX, limit);

  let offset = searchParams.get("offset")
    ? Number.parseInt(searchParams.get("offset")!, 10)
    : 0;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const qRaw = searchParams.get("q")?.trim() ?? "";
  const q = qRaw.length >= 2 ? qRaw.slice(0, 80) : null;

  // Default KRS pins: indikator=krs bila param tidak dikirim sama sekali.
  // indikator= (kosong) = tanpa filter indikator (user sengaja clear).
  const indikatorRaw = searchParams.get("indikator");
  const indikator =
    indikatorRaw === null
      ? (["krs"] as TpkKeluargaIndikatorFilter[])
      : parseCsvParam(indikatorRaw, INDIKATOR_FILTER_VALUES);

  return {
    kelurahanId,
    provinsiId,
    prioritas: parseCsvParam(searchParams.get("prioritas"), PRIORITAS_VALUES),
    indikator,
    validCoordsOnly: parseBoolParam(
      searchParams.get("validCoordsOnly"),
      true,
    ),
    q,
    bbox: parseBboxParam(searchParams.get("bbox")),
    limit,
    offset,
  };
}

/** Pin keluarga/KRS se-kelurahan — by_name, cache 60 dtk, hard max 2000. */
export async function fetchKrsPoints(
  query: KrsPointsQuery,
): Promise<KrsPointsPayload> {
  const source = resolveDataSource();
  const key = cacheKey([
    "krs-points",
    source,
    query.kelurahanId,
    query.provinsiId,
    query.prioritas.join("|"),
    query.indikator.join("|"),
    query.validCoordsOnly ? "1" : "0",
    query.q ?? "",
    query.bbox
      ? `${query.bbox.west},${query.bbox.south},${query.bbox.east},${query.bbox.north}`
      : "",
    query.limit,
    query.offset,
  ]);
  const hit = getCached<KrsPointsPayload>(key);
  if (hit) return hit;

  let payload: KrsPointsPayload;
  if (source === "postgres") {
    assertPostgresReady();
    payload = await getKrsPointsPostgres(query);
  } else {
    payload = getKrsPointsMock(query);
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
