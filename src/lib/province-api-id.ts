import { provinces, type Province } from "@/lib/map-data";

/**
 * Pemetaan slug UI (`province.id`) → `id_provinsi` / `ProvinsiID` (pk2025.v_provinsi).
 * Bukan kode BPS/Kemendagri (`adminCode` di GeoJSON peta).
 *
 * Contoh: jabar slug → 12 (live), bukan adminCode 32 (BPS).
 */
export const PROVINSI_ID_BY_SLUG: Record<string, number> = {
  aceh: 1,
  sumut: 2,
  sumbar: 3,
  riau: 4,
  jambi: 5,
  sumsel: 6,
  bengkulu: 7,
  lampung: 8,
  babel: 9,
  kepri: 10,
  dki: 11,
  jabar: 12,
  jateng: 13,
  diy: 14,
  jatim: 15,
  banten: 16,
  bali: 17,
  ntb: 18,
  ntt: 19,
  kalbar: 20,
  kalteng: 21,
  kalsel: 22,
  kaltim: 23,
  sulut: 24,
  sulteng: 25,
  sulsel: 26,
  sultra: 27,
  gorontalo: 28,
  sulbar: 29,
  maluku: 30,
  malut: 31,
  papua: 32,
  papbar: 33,
  kalut: 36,
  /** DOB Papua (UU 29–32/2022) — id_provinsi 37–40; Kemendagri 93–96. */
  papsel: 37,
  papteng: 38,
  pappeg: 39,
  papbd: 40,
};

const SLUG_BY_PROVINSI_ID: Record<number, string> = Object.fromEntries(
  Object.entries(PROVINSI_ID_BY_SLUG).map(([slug, id]) => [id, slug]),
) as Record<number, string>;

function normalizeNama(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(provinsi|daerah istimewa|di)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * ID numerik untuk `GET /api/ringkasan?tingkat=provinsi&id=…`.
 * Preferensi: slug → id_provinsi; fallback adminCode hanya untuk mock lama.
 */
export function getProvinsiApiId(province: Province): string | null {
  const mapped = PROVINSI_ID_BY_SLUG[province.id];
  if (mapped != null) return String(mapped);
  if (province.adminCode > 0) return String(province.adminCode);
  const asNum = Number.parseInt(province.id, 10);
  if (Number.isFinite(asNum) && asNum > 0) return String(asNum);
  return null;
}

/** Resolve baris peringkat live (id = id_provinsi) atau mock (id = slug). */
export function resolveProvinceFromPeringkatId(
  id: string,
  nama?: string,
): Province | null {
  const bySlug = provinces.find((entry) => entry.id === id);
  if (bySlug) return bySlug;

  const numeric = Number.parseInt(id, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    const slug = SLUG_BY_PROVINSI_ID[numeric];
    if (slug) {
      const byMappedSlug = provinces.find((entry) => entry.id === slug);
      if (byMappedSlug) return byMappedSlug;
    }
  }

  if (nama) {
    const target = normalizeNama(nama);
    const byName = provinces.find(
      (entry) => normalizeNama(entry.name) === target,
    );
    if (byName) return byName;
  }

  return null;
}

/** Resolve id query mock/API: slug, id_provinsi, atau adminCode BPS. */
export function resolveProvinceFromRingkasanId(id: string): Province | null {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const bySlug = provinces.find((entry) => entry.id === trimmed);
  if (bySlug) return bySlug;

  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const slug = SLUG_BY_PROVINSI_ID[numeric];
  if (slug) {
    const byMapped = provinces.find((entry) => entry.id === slug);
    if (byMapped) return byMapped;
  }

  return provinces.find((entry) => entry.adminCode === numeric) ?? null;
}
