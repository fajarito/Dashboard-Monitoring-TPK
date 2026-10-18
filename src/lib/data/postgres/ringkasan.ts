import { getRingkasanMock } from "@/lib/data/mock/ringkasan";
import { arePostgresPoolsConfigured, getPool } from "@/lib/data/postgres/pools";
import type { RingkasanPayload, RingkasanQuery } from "@/lib/data/types";

/**
 * Stub adapter Postgres untuk ringkasan.
 *
 * Live SQL (MV agregat) belum diimplementasi — jika pool belum siap
 * atau query belum ada, fallback ke mock dengan meta.source tetap
 * mencerminkan sumber efektif ("mock").
 *
 * Rencana query (fase 2, jangan scan by_name):
 * - SIGA: COUNT dat_TPK / dat_AnggotaTPK / dat_PKB (± Status=1) per wilayah
 * - DWH: SUM fs_stunting_by_rekap_* (grain RT digulung ke provinsi/nasional)
 * - WILAYAH: lookup nama (opsional di ringkasan)
 */
export async function getRingkasanPostgres(
  query: RingkasanQuery,
): Promise<RingkasanPayload> {
  if (!arePostgresPoolsConfigured()) {
    return getRingkasanMock(query);
  }

  // Struktur siap: pastikan pool bisa diambil tanpa throw.
  await Promise.all([getPool("siga"), getPool("wilayah"), getPool("dwh")]);

  // TODO: SELECT dari materialized view ringkas — belum ada.
  // Sementara fallback mock agar kontrak API tetap hidup.
  const payload = getRingkasanMock(query);
  return {
    ...payload,
    meta: {
      ...payload.meta,
      // Tetap "mock" karena query live belum dijalankan.
      source: "mock",
    },
  };
}
