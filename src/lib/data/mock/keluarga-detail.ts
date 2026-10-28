import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { mapStuntingHeadRow } from "@/lib/data/keluarga-detail-map";
import { compactKki, kkiEquals } from "@/lib/data/kki";
import { STUNTING_HEAD_SEED } from "@/lib/data/mock/stunting-head-seed";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import type {
  KeluargaDetailPayload,
  KeluargaDetailQuery,
} from "@/lib/data/types";

/**
 * Detail keluarga mock dari sample stunting_head.
 * Lookup **by KKI** (`stunting_head.kki`) — bukan NIK/NoKK.
 */
export function getKeluargaDetailMock(
  query: KeluargaDetailQuery,
): KeluargaDetailPayload {
  const compact = compactKki(query.kki);
  if (!compact) {
    throw new PostgresDataError(
      "invalid_kki",
      "Parameter kki wajib diisi.",
      { status: 400 },
    );
  }

  const row = STUNTING_HEAD_SEED.find((entry) => {
    if (!kkiEquals(entry.kki, query.kki)) return false;
    if (
      query.provinsiId != null &&
      entry.id_provinsi != null &&
      entry.id_provinsi !== query.provinsiId
    ) {
      return false;
    }
    return true;
  });

  if (!row) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Detail keluarga tidak ditemukan untuk KKI ${compact}.`,
      { status: 404 },
    );
  }

  const item = mapStuntingHeadRow(row);
  if (!item) {
    throw new PostgresDataError(
      "keluarga_not_found",
      `Baris stunting_head tidak valid untuk KKI ${compact}.`,
      { status: 404 },
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
      source: "mock",
      generatedAt: new Date().toISOString(),
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
    },
  };
}
