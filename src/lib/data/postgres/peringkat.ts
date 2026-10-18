import { getPeringkatProvinsiMock } from "@/lib/data/mock/peringkat";
import { arePostgresPoolsConfigured, getPool } from "@/lib/data/postgres/pools";
import type { PeringkatProvinsiPayload } from "@/lib/data/types";

/**
 * Stub adapter Postgres untuk peringkat provinsi (max 40 baris).
 * Live SQL belum — fallback mock jika env kosong / query belum siap.
 */
export async function getPeringkatProvinsiPostgres(): Promise<PeringkatProvinsiPayload> {
  if (!arePostgresPoolsConfigured()) {
    return getPeringkatProvinsiMock();
  }

  await Promise.all([getPool("siga"), getPool("dwh")]);

  const payload = getPeringkatProvinsiMock();
  return {
    ...payload,
    meta: {
      ...payload.meta,
      source: "mock",
    },
  };
}
