/**
 * Lookup nama wilayah dari MV/view pk2025 (host WILAYAH).
 * Dipakai untuk header/breadcrumb halaman drill-down —
 * jangan tampilkan id mentah sebagai judul.
 *
 * Tanpa pool postgres: fallback ke seed mock (snapshot v_kabupaten / sample kec-kel)
 * agar slug & numeric id routes tetap punya nama di lingkungan demo.
 */

import {
  arePostgresPoolsConfigured,
  queryPool,
} from "@/lib/data/postgres/pools";

import kabSeed from "@/lib/data/mock/wilayah-nama-kab-seed.json";
import kecSeed from "@/lib/data/mock/wilayah-nama-kec-seed.json";
import kelSeed from "@/lib/data/mock/wilayah-nama-kel-seed.json";

type NamaKabRow = { nama_kabupaten: string | null };
type NamaKecRow = { nama_kecamatan: string | null };
type NamaKelRow = { nama_kelurahan: string | null };

const NAMA_KAB_SEED = kabSeed as Record<string, string>;
const NAMA_KEC_SEED = kecSeed as Record<string, string>;
const NAMA_KEL_SEED = kelSeed as Record<string, string>;

function toPositiveInt(id: string | number): number | null {
  const n =
    typeof id === "number" ? id : Number.parseInt(String(id).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function seedNama(
  seed: Record<string, string>,
  id: number,
): string | null {
  const nama = seed[String(id)]?.trim();
  return nama || null;
}

/** Satu baris `v_kabupaten` by id_kabupaten. */
export async function lookupNamaKabupatenById(
  id: string | number,
): Promise<string | null> {
  const n = toPositiveInt(id);
  if (n == null) return null;

  if (!arePostgresPoolsConfigured()) {
    return seedNama(NAMA_KAB_SEED, n);
  }

  try {
    const res = await queryPool<NamaKabRow>(
      "wilayah",
      `SELECT k."nama_kabupaten"
       FROM "pk2025"."v_kabupaten" k
       WHERE k."id_kabupaten" = $1
       LIMIT 1`,
      [n],
    );
    const nama = res.rows[0]?.nama_kabupaten?.trim();
    return nama || seedNama(NAMA_KAB_SEED, n);
  } catch {
    return seedNama(NAMA_KAB_SEED, n);
  }
}

/** Satu baris `v_kecamatan` by id_kecamatan. */
export async function lookupNamaKecamatanById(
  id: string | number,
): Promise<string | null> {
  const n = toPositiveInt(id);
  if (n == null) return null;

  if (!arePostgresPoolsConfigured()) {
    return seedNama(NAMA_KEC_SEED, n);
  }

  try {
    const res = await queryPool<NamaKecRow>(
      "wilayah",
      `SELECT k."nama_kecamatan"
       FROM "pk2025"."v_kecamatan" k
       WHERE k."id_kecamatan" = $1
       LIMIT 1`,
      [n],
    );
    const nama = res.rows[0]?.nama_kecamatan?.trim();
    return nama || seedNama(NAMA_KEC_SEED, n);
  } catch {
    return seedNama(NAMA_KEC_SEED, n);
  }
}

/** Satu baris `v_kelurahan` by id_kelurahan. */
export async function lookupNamaKelurahanById(
  id: string | number,
): Promise<string | null> {
  const n = toPositiveInt(id);
  if (n == null) return null;

  if (!arePostgresPoolsConfigured()) {
    return seedNama(NAMA_KEL_SEED, n);
  }

  try {
    const res = await queryPool<NamaKelRow>(
      "wilayah",
      `SELECT k."nama_kelurahan"
       FROM "pk2025"."v_kelurahan" k
       WHERE k."id_kelurahan" = $1
       LIMIT 1`,
      [n],
    );
    const nama = res.rows[0]?.nama_kelurahan?.trim();
    return nama || seedNama(NAMA_KEL_SEED, n);
  } catch {
    return seedNama(NAMA_KEL_SEED, n);
  }
}
