import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { isValidIdCoords } from "@/lib/data/geo-coords";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  getDwhPeriode,
  getPoolConfigs,
  queryPool,
} from "@/lib/data/postgres/pools";
import {
  buildFilterSql,
  mapPrioritas,
} from "@/lib/data/postgres/tpk-keluarga";
import type {
  KrsPointItem,
  KrsPointsPayload,
  KrsPointsQuery,
} from "@/lib/data/types";

type NamaKelRow = { id_kelurahan: number; nama_kelurahan: string };

type CountRow = { n: string | number };

type PointRow = {
  kode_keluarga: string | null;
  nama_kepala: string | null;
  prioritas_raw: string | null;
  risiko_stunting: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
};

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

function toFloat(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function isFlagV(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "V";
}

function mapPoint(
  row: PointRow,
  requireIdRange: boolean,
): KrsPointItem | null {
  const kode = row.kode_keluarga?.trim();
  const nama = row.nama_kepala?.trim();
  const lat = toFloat(row.latitude);
  const lng = toFloat(row.longitude);
  if (!kode || !nama) return null;
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (requireIdRange && !isValidIdCoords(lat, lng)) return null;
  return {
    id: kode,
    kodeKeluarga: kode,
    namaKepalaKeluarga: nama,
    prioritas: mapPrioritas(row.prioritas_raw, row.risiko_stunting),
    krs: isFlagV(row.risiko_stunting),
    latitude: lat,
    longitude: lng,
  };
}

/**
 * Pin keluarga se-kelurahan (by_name), DISTINCT kode, valid coords.
 * Wajib periode + id_provinsi + id_kelurahan — tanpa scan nasional.
 */
export async function getKrsPointsPostgres(
  query: KrsPointsQuery,
): Promise<KrsPointsPayload> {
  if (!getPoolConfigs().dwh.ready) {
    throw new PostgresDataError(
      "dwh_not_configured",
      "Pool DWH belum dikonfigurasi — pin KRS membutuhkan DATABASE_URL_DWH.",
      { status: 503 },
    );
  }

  const periode = getDwhPeriode();
  const filter = buildFilterSql(query.prioritas, query.indikator);
  const extraParts: string[] = [];
  const extraParams: unknown[] = [];
  let next = 4 + filter.params.length;

  // Endpoint pin selalu butuh lat/lng non-null; validCoordsOnly = rentang Indonesia.
  extraParts.push(`b."latitude" IS NOT NULL`, `b."longitude" IS NOT NULL`);
  if (query.validCoordsOnly) {
    extraParts.push(
      `b."latitude"::float8 BETWEEN -11.5 AND 6.5`,
      `b."longitude"::float8 BETWEEN 94.5 AND 141.5`,
    );
  }

  if (query.bbox) {
    extraParts.push(
      `b."latitude"::float8 BETWEEN $${next} AND $${next + 1}`,
      `b."longitude"::float8 BETWEEN $${next + 2} AND $${next + 3}`,
    );
    extraParams.push(
      query.bbox.south,
      query.bbox.north,
      query.bbox.west,
      query.bbox.east,
    );
    next += 4;
  }

  if (query.q) {
    extraParts.push(
      `NULLIF(TRIM(BOTH FROM b."nama_kepala_keluarga"), '') ILIKE $${next}`,
    );
    extraParams.push(`%${query.q}%`);
    next += 1;
  }

  const extraSql =
    extraParts.length > 0 ? ` AND ${extraParts.join(" AND ")}` : "";

  const baseParams: unknown[] = [
    periode,
    query.provinsiId,
    query.kelurahanId,
    ...filter.params,
    ...extraParams,
  ];

  const dedupCte = `
WITH dedup AS (
  SELECT DISTINCT ON (NULLIF(TRIM(BOTH FROM src."kode_keluarga"), ''))
    src."kode_keluarga",
    src."nama_kepala_keluarga",
    src."kesejahteraan_prioritas",
    src."risiko_stunting",
    src."baduta",
    src."balita",
    src."pus",
    src."pus_hamil",
    src."jamban_layak_tidak",
    src."sumber_air_layak_tidak",
    src."latitude",
    src."longitude",
    src."nama_kelurahan"
  FROM "dwh_pk2025"."fs_stunting_by_name_rdk_pk25_semester1" src
  WHERE src."periode" = $1
    AND src."id_provinsi" = $2
    AND src."id_kelurahan" = $3
    AND NULLIF(TRIM(BOTH FROM src."kode_keluarga"), '') IS NOT NULL
  ORDER BY
    NULLIF(TRIM(BOTH FROM src."kode_keluarga"), ''),
    src."risiko_stunting" DESC NULLS LAST
)
`;

  const whereTail = `
WHERE TRUE
${filter.sql}
${extraSql}
`;

  const countSql = `
${dedupCte}
SELECT COUNT(*)::int AS n
FROM dedup b
${whereTail}
`;

  const listSql = `
${dedupCte}
SELECT
  NULLIF(TRIM(BOTH FROM b."kode_keluarga"), '') AS kode_keluarga,
  NULLIF(TRIM(BOTH FROM b."nama_kepala_keluarga"), '') AS nama_kepala,
  NULLIF(TRIM(BOTH FROM b."kesejahteraan_prioritas"), '') AS prioritas_raw,
  NULLIF(TRIM(BOTH FROM b."risiko_stunting"), '') AS risiko_stunting,
  b."latitude" AS latitude,
  b."longitude" AS longitude
FROM dedup b
${whereTail}
ORDER BY
  CASE
    WHEN UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'
      AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) = '1' THEN 1
    WHEN UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'
      AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) = '2' THEN 2
    WHEN UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'
      AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) = '3' THEN 3
    WHEN UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'
      AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) = '4' THEN 4
    WHEN UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V' THEN 5
    ELSE 6
  END,
  NULLIF(TRIM(BOTH FROM b."nama_kepala_keluarga"), '') ASC NULLS LAST
LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
`;

  const [countRes, listRes, namaKelRes] = await Promise.all([
    queryPool<CountRow>("dwh", countSql, baseParams),
    queryPool<PointRow>("dwh", listSql, [
      ...baseParams,
      query.limit,
      query.offset,
    ]),
    getPoolConfigs().wilayah.ready
      ? queryPool<NamaKelRow>(
          "wilayah",
          `SELECT k."id_kelurahan", k."nama_kelurahan"
           FROM "pk2025"."v_kelurahan" k
           WHERE k."id_kelurahan" = $1`,
          [query.kelurahanId],
        ).catch(() => ({ rows: [] as NamaKelRow[] }))
      : Promise.resolve({ rows: [] as NamaKelRow[] }),
  ]);

  const total = toInt(countRes.rows[0]?.n);
  const items: KrsPointItem[] = [];
  for (const row of listRes.rows) {
    const mapped = mapPoint(row, query.validCoordsOnly);
    if (mapped) items.push(mapped);
  }

  return {
    items,
    total,
    returned: items.length,
    truncated: total > query.offset + items.length,
    limit: query.limit,
    offset: query.offset,
    filters: {
      kelurahanId: query.kelurahanId,
      provinsiId: query.provinsiId,
      prioritas: query.prioritas,
      indikator: query.indikator,
      validCoordsOnly: query.validCoordsOnly,
      q: query.q,
      bbox: query.bbox,
    },
    grain: {
      level: "kelurahan",
      kelurahanId: query.kelurahanId,
      namaKelurahan: namaKelRes.rows[0]?.nama_kelurahan?.trim() || null,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
