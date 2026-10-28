import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import {
  mapStuntingHeadRow,
  type StuntingHeadRowRow,
} from "@/lib/data/keluarga-detail-map";
import { compactKki } from "@/lib/data/kki";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import { queryPool } from "@/lib/data/postgres/pools";
import type {
  KeluargaDetailPayload,
  KeluargaDetailQuery,
} from "@/lib/data/types";

/**
 * Baca 1 keluarga dari parent partition `verval2024_monitoring.stunting_head`.
 * Join **by KKI**: compact(`kki`) = pin.kki.
 * Bukan NIK / NoKK. Pool SIGA (owner dump `dev_siga`).
 */
export async function getKeluargaDetailPostgres(
  query: KeluargaDetailQuery,
): Promise<KeluargaDetailPayload> {
  const compact = compactKki(query.kki);
  if (!compact) {
    throw new PostgresDataError(
      "invalid_kki",
      "Parameter kki wajib diisi.",
      { status: 400 },
    );
  }

  const params: unknown[] = [compact];
  let provinsiClause = "";
  if (query.provinsiId != null) {
    params.push(query.provinsiId);
    provinsiClause = `AND src."id_provinsi" = $2`;
  }

  const sql = `
SELECT
  src."id_stunting",
  src."kki",
  src."id_provinsi",
  src."id_kelurahan",
  src."no_kk",
  src."nama_kk",
  src."nama_istri",
  src."alamat",
  src."latitude",
  src."longitude",
  src."kesejahteraan_prioritas",
  src."resiko_stunting",
  src."jns_atap",
  src."kondisi_atap",
  src."jns_dinding",
  src."kondisi_dinding",
  src."jns_lantai",
  src."kondisi_lantai",
  src."sumber_air_minum",
  src."kondisi_sumber_air_minum",
  src."memiliki_tempat_bab",
  src."kondisi_fasilitas_bab",
  src."foto_rumah",
  src."foto_jamban",
  src."luas_rumah",
  src."jml_orang_tinggal",
  src."keterangan"
FROM "verval2024_monitoring"."stunting_head" src
WHERE regexp_replace(TRIM(BOTH FROM COALESCE(src."kki", '')), '\\s+', '', 'g') = $1
  ${provinsiClause}
ORDER BY src."updated_date" DESC NULLS LAST, src."id_stunting" DESC
LIMIT 1
`;

  const result = await queryPool<StuntingHeadRowRow>("siga", sql, params);
  const row = result.rows[0];
  if (!row) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Detail keluarga tidak ditemukan untuk KKI ${compact}.`,
      { pool: "siga", status: 404 },
    );
  }

  const item = mapStuntingHeadRow(row);
  if (!item) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Baris stunting_head tidak valid untuk KKI ${compact}.`,
      { pool: "siga", status: 404 },
    );
  }

  return {
    item,
    join: {
      key: "kki",
      pinField: "kki",
      headField: "kki",
      byNameColumn: "kode_keluarga",
    },
    meta: {
      source: "postgres",
      generatedAt: new Date().toISOString(),
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
    },
  };
}
