/**
 * Pemetaan slug UI / search id → `id_kabupaten` (pk2025.v_kabupaten).
 * Bukan kode Depdagri. Dipakai mock + deep-link home (`?wilayah=` / filter kab).
 *
 * Sumber sample: docs/schema/v_kabupaten_*.json (Jawa Barat = id_provinsi 12).
 */

/** Slug hierarki mock / search → id_kabupaten. */
export const KABUPATEN_ID_BY_SLUG: Record<string, number> = {
  "kota-depok": 166,
  "kota-bandung": 161,
  "kab-bandung": 150,
  "kab-bandung-barat": 151,
  "kab-bogor": 147,
  "kota-bogor": 163,
  "kota-bekasi": 165,
  "kab-bekasi": 144,
  "kab-karawang": 145,
  "kota-cirebon": 162,
  "kab-cirebon": 156,
  "kab-garut": 153,
  "kab-sukabumi": 148,
  "kota-sukabumi": 164,
  "kab-cianjur": 149,
  "kab-tasikmalaya": 154,
  "kota-tasikmalaya": 168,
  "kota-cimahi": 167,
  "kab-pangandaran": 499,
  "kab-sleman": 206,
};

/** Nama kab (normalized) → id untuk mock resolve. */
const KABUPATEN_ID_BY_NAME: Record<string, number> = {
  "kota depok": 166,
  "kota bandung": 161,
  "kabupaten bandung": 150,
  bandung: 150,
  "bandung barat": 151,
  "kabupaten bogor": 147,
  bogor: 147,
  "kota bogor": 163,
  "kota bekasi": 165,
  "kabupaten bekasi": 144,
  bekasi: 144,
  "kabupaten karawang": 145,
  karawang: 145,
  "kota cirebon": 162,
  "kabupaten cirebon": 156,
  cirebon: 156,
  "kabupaten garut": 153,
  garut: 153,
};

function normalizeNama(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(kabupaten|kota|kab)\b/g, (m) =>
      m.toLowerCase().startsWith("kota") ? "kota" : "kabupaten",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SLUG_BY_KABUPATEN_ID: Record<number, string> = Object.fromEntries(
  Object.entries(KABUPATEN_ID_BY_SLUG).map(([slug, id]) => [id, slug]),
) as Record<number, string>;

/** Slug UI dari id_kabupaten (untuk deep-link hierarki mock). */
export function getKabupatenSlugByApiId(apiId: string | number): string | null {
  const n =
    typeof apiId === "number"
      ? apiId
      : Number.parseInt(String(apiId).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return SLUG_BY_KABUPATEN_ID[n] ?? null;
}

/** ID numerik untuk `GET /api/ringkasan?tingkat=kabupaten&id=…`. */
export function getKabupatenApiId(slugOrId: string): string | null {
  const trimmed = slugOrId.trim();
  if (!trimmed) return null;

  const bySlug = KABUPATEN_ID_BY_SLUG[trimmed];
  if (bySlug != null) return String(bySlug);

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric > 0 && String(numeric) === trimmed) {
    return String(numeric);
  }

  return null;
}

/** Resolve id query: slug UI, id_kabupaten, atau nama (mock). */
export function resolveKabupatenApiId(
  idOrSlug: string,
  namaHint?: string,
): number | null {
  const fromSlug = getKabupatenApiId(idOrSlug);
  if (fromSlug) return Number.parseInt(fromSlug, 10);

  if (namaHint) {
    const key = normalizeNama(namaHint);
    const byName = KABUPATEN_ID_BY_NAME[key];
    if (byName != null) return byName;
  }

  const key = normalizeNama(idOrSlug);
  return KABUPATEN_ID_BY_NAME[key] ?? null;
}
