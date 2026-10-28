import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getTpkKeluargaMock } from "@/lib/data/mock/tpk-keluarga";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  getDwhPeriode,
  getPoolConfigs,
  queryPool,
} from "@/lib/data/postgres/pools";
import {
  SQL_TPK_BY_ID,
  SQL_TPK_COUNT_SE_KELURAHAN,
} from "@/lib/data/postgres/tpk-detail";
import {
  getKelurahanRekapMap,
  isSigaConfigured,
} from "@/lib/data/postgres/tpk-list";
import type {
  TpkKeluargaIndikatorFilter,
  TpkKeluargaItem,
  TpkKeluargaPayload,
  TpkKeluargaPrioritas,
  TpkKeluargaQuery,
} from "@/lib/data/types";

type SigaTpkRow = {
  tpkid: string;
  kelurahanid: number | null;
  provinsiid: number | null;
  kabupatenid: number | null;
};

type NamaKelRow = { id_kelurahan: number; nama_kelurahan: string };

type CountRow = { n: string | number };

type ByNameRow = {
  kode_keluarga: string | null;
  nama_kepala: string | null;
  prioritas_raw: string | null;
  risiko_stunting: string | null;
  baduta: string | null;
  balita: string | null;
  pus: string | null;
  pus_hamil: string | null;
  jamban_tl: string | null;
  air_tl: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  nama_kelurahan: string | null;
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

/** Flag DWH by_name: V = ya, selain itu tidak. */
function isFlagV(value: string | null | undefined): boolean {
  return (value ?? "").trim().toUpperCase() === "V";
}

/**
 * Map kesejahteraan_prioritas + risiko_stunting → slice UI.
 * KRS = risiko_stunting V; dalam KRS: 1–4 → p1–p4, selainnya → bukan.
 */
export function mapPrioritas(
  raw: string | null | undefined,
  risiko: string | null | undefined,
): TpkKeluargaPrioritas {
  if (!isFlagV(risiko)) return "tidakRisiko";
  const code = (raw ?? "").trim();
  if (code === "1") return "p1";
  if (code === "2") return "p2";
  if (code === "3") return "p3";
  if (code === "4") return "p4";
  return "bukan";
}

/**
 * Bangun predikat filter prioritas + indikator.
 * Param $1=periode, $2=id_provinsi, $3=id_kelurahan; digit prioritas menyusul.
 * Diekspor agar endpoint pin KRS memakai predikat yang sama.
 */
export function buildFilterSql(
  prioritas: TpkKeluargaPrioritas[],
  indikator: TpkKeluargaIndikatorFilter[],
): { sql: string; params: string[] } {
  const parts: string[] = [];
  const params: string[] = [];
  let next = 4;

  if (prioritas.length > 0) {
    const orParts: string[] = [];
    for (const p of prioritas) {
      if (p === "tidakRisiko") {
        orParts.push(
          `(UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) IS DISTINCT FROM 'V')`,
        );
        continue;
      }
      const krs = `UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'`;
      if (p === "bukan") {
        orParts.push(
          `(${krs} AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) NOT IN ('1','2','3','4'))`,
        );
        continue;
      }
      const digit =
        p === "p1" ? "1" : p === "p2" ? "2" : p === "p3" ? "3" : "4";
      params.push(digit);
      orParts.push(
        `(${krs} AND TRIM(BOTH FROM COALESCE(b."kesejahteraan_prioritas", '')) = $${next})`,
      );
      next += 1;
    }
    parts.push(`(${orParts.join(" OR ")})`);
  }

  for (const key of indikator) {
    if (key === "baduta") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."baduta", ''))) = 'V'`,
      );
    } else if (key === "balita") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."balita", ''))) = 'V'`,
      );
    } else if (key === "ibuHamil") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."pus_hamil", ''))) = 'V'`,
      );
    } else if (key === "jambanTidakLayak") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."jamban_layak_tidak", ''))) = 'V'`,
      );
    } else if (key === "sumberAirTidakLayak") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."sumber_air_layak_tidak", ''))) = 'V'`,
      );
    } else if (key === "krs") {
      parts.push(
        `UPPER(TRIM(BOTH FROM COALESCE(b."risiko_stunting", ''))) = 'V'`,
      );
    }
  }

  if (parts.length === 0) return { sql: "", params: [] };
  return { sql: ` AND ${parts.join(" AND ")}`, params };
}

function mapRow(row: ByNameRow): TpkKeluargaItem | null {
  const kode = row.kode_keluarga?.trim();
  const nama = row.nama_kepala?.trim();
  if (!kode || !nama) return null;
  return {
    id: kode,
    kodeKeluarga: kode,
    namaKepalaKeluarga: nama,
    prioritas: mapPrioritas(row.prioritas_raw, row.risiko_stunting),
    indikator: {
      baduta: isFlagV(row.baduta),
      balita: isFlagV(row.balita),
      pus: isFlagV(row.pus),
      ibuHamil: isFlagV(row.pus_hamil),
      krs: isFlagV(row.risiko_stunting),
      jambanTidakLayak: isFlagV(row.jamban_tl),
      sumberAirTidakLayak: isFlagV(row.air_tl),
      rtlh: false,
    },
    latitude: toFloat(row.latitude),
    longitude: toFloat(row.longitude),
    namaKelurahan: row.nama_kelurahan?.trim() || null,
  };
}

function emptyPayload(
  tpkId: string,
  query: TpkKeluargaQuery,
  grain: TpkKeluargaPayload["grain"],
): TpkKeluargaPayload {
  return {
    tpkId,
    items: [],
    page: query.page,
    pageSize: query.pageSize,
    total: 0,
    totalPages: 0,
    filters: {
      prioritas: query.prioritas,
      indikator: query.indikator,
    },
    grain,
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Daftar keluarga sasaran se-kelurahan TPK (by_name, paging).
 * Wajib filter periode + id_provinsi (partition prune) + id_kelurahan.
 * DISTINCT ON kode_keluarga agar tidak double-count.
 */
export async function getTpkKeluargaPostgres(
  tpkId: string,
  query: TpkKeluargaQuery,
): Promise<TpkKeluargaPayload | null> {
  if (!isSigaConfigured()) {
    return getTpkKeluargaMock(tpkId, query);
  }

  const id = tpkId.trim();
  if (!id) {
    throw new PostgresDataError("invalid_tpk_id", "TPKID tidak valid.", {
      status: 400,
    });
  }

  if (!getPoolConfigs().dwh.ready) {
    throw new PostgresDataError(
      "dwh_not_configured",
      "Pool DWH belum dikonfigurasi — daftar keluarga membutuhkan DATABASE_URL_DWH.",
      { status: 503 },
    );
  }

  const tpkRes = await queryPool<SigaTpkRow>("siga", SQL_TPK_BY_ID, [id]);
  const tpk = tpkRes.rows[0];
  if (!tpk?.tpkid) return null;

  const kelId = tpk.kelurahanid != null ? toInt(tpk.kelurahanid) : null;
  const provId = tpk.provinsiid != null ? toInt(tpk.provinsiid) : null;
  const kabId = tpk.kabupatenid != null ? toInt(tpk.kabupatenid) : null;

  if (kelId == null || provId == null) {
    return emptyPayload(tpk.tpkid, query, {
      level: "kelurahan",
      kelurahanId: kelId,
      namaKelurahan: null,
      tpkSeDesa: 1,
      keluargaSasaranRekap: null,
      krsRekap: null,
    });
  }

  const periode = getDwhPeriode();
  const filter = buildFilterSql(query.prioritas, query.indikator);
  const baseParams: unknown[] = [periode, provId, kelId, ...filter.params];
  const offset = (query.page - 1) * query.pageSize;

  /**
   * Dedup dulu (DISTINCT ON kode), baru filter + sort + page.
   * Hindari double-count bila ada baris duplikat kode_keluarga.
   */
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

  const countSql = `
${dedupCte}
SELECT COUNT(*)::int AS n
FROM dedup b
WHERE TRUE
${filter.sql}
`;

  const listSql = `
${dedupCte}
SELECT
  NULLIF(TRIM(BOTH FROM b."kode_keluarga"), '') AS kode_keluarga,
  NULLIF(TRIM(BOTH FROM b."nama_kepala_keluarga"), '') AS nama_kepala,
  NULLIF(TRIM(BOTH FROM b."kesejahteraan_prioritas"), '') AS prioritas_raw,
  NULLIF(TRIM(BOTH FROM b."risiko_stunting"), '') AS risiko_stunting,
  NULLIF(TRIM(BOTH FROM b."baduta"), '') AS baduta,
  NULLIF(TRIM(BOTH FROM b."balita"), '') AS balita,
  NULLIF(TRIM(BOTH FROM b."pus"), '') AS pus,
  NULLIF(TRIM(BOTH FROM b."pus_hamil"), '') AS pus_hamil,
  NULLIF(TRIM(BOTH FROM b."jamban_layak_tidak"), '') AS jamban_tl,
  NULLIF(TRIM(BOTH FROM b."sumber_air_layak_tidak"), '') AS air_tl,
  b."latitude" AS latitude,
  b."longitude" AS longitude,
  NULLIF(TRIM(BOTH FROM b."nama_kelurahan"), '') AS nama_kelurahan
FROM dedup b
WHERE TRUE
${filter.sql}
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
  NULLIF(TRIM(BOTH FROM b."nama_kepala_keluarga"), '') ASC NULLS LAST,
  NULLIF(TRIM(BOTH FROM b."kode_keluarga"), '') ASC
LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}
`;

  const [countRes, listRes, tpkSeDesaRes, rekapMap, namaKelRes] =
    await Promise.all([
      queryPool<CountRow>("dwh", countSql, baseParams),
      queryPool<ByNameRow>("dwh", listSql, [
        ...baseParams,
        query.pageSize,
        offset,
      ]),
      queryPool<CountRow>("siga", SQL_TPK_COUNT_SE_KELURAHAN, [kelId]).catch(
        () => ({ rows: [{ n: 1 }] as CountRow[] }),
      ),
      getKelurahanRekapMap(provId, kabId, null, kelId),
      getPoolConfigs().wilayah.ready
        ? queryPool<NamaKelRow>(
            "wilayah",
            `SELECT k."id_kelurahan", k."nama_kelurahan"
             FROM "pk2025"."v_kelurahan" k
             WHERE k."id_kelurahan" = $1`,
            [kelId],
          ).catch(() => ({ rows: [] as NamaKelRow[] }))
        : Promise.resolve({ rows: [] as NamaKelRow[] }),
    ]);

  const total = toInt(countRes.rows[0]?.n);
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const items: TpkKeluargaItem[] = [];
  for (const row of listRes.rows) {
    const mapped = mapRow(row);
    if (mapped) items.push(mapped);
  }

  const rekap = rekapMap.get(kelId);
  const namaKelurahan =
    namaKelRes.rows[0]?.nama_kelurahan?.trim() ||
    items[0]?.namaKelurahan ||
    null;

  return {
    tpkId: tpk.tpkid,
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      prioritas: query.prioritas,
      indikator: query.indikator,
    },
    grain: {
      level: "kelurahan",
      kelurahanId: kelId,
      namaKelurahan,
      tpkSeDesa: Math.max(1, toInt(tpkSeDesaRes.rows[0]?.n)),
      keluargaSasaranRekap: rekap?.keluargaSasaran ?? null,
      krsRekap: rekap?.krs ?? null,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
