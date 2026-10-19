/**
 * Pemetaan slug UI mock → id_kecamatan (pk2025.v_kecamatan).
 * Bukan kode Depdagri. Untuk deep-link hierarki mock (Depok) + id numerik live.
 *
 * ID sintetis mock (16_6xx) hanya untuk DATA_SOURCE=mock — live memakai id asli DB.
 */

/** Slug hierarki mock Depok → id_kecamatan (mock-stable). */
export const KECAMATAN_ID_BY_SLUG: Record<string, number> = {
  "kec-beji-depok": 16601,
  "kec-bojongsari-depok": 16602,
  "kec-cilodong-depok": 16603,
  "kec-cimanggis-depok": 16604,
  "kec-cinere-depok": 16605,
  "kec-cipayung-depok": 16606,
  "kec-limo-depok": 16607,
  "kec-pancoranmas-depok": 16608,
  "kec-sawangan-depok": 16609,
  "kec-sukmajaya-depok": 16610,
  "kec-tapos-depok": 16611,
};

const SLUG_BY_KECAMATAN_ID: Record<number, string> = Object.fromEntries(
  Object.entries(KECAMATAN_ID_BY_SLUG).map(([slug, id]) => [id, slug]),
) as Record<number, string>;

/** Slug UI dari id_kecamatan (deep-link hierarki mock). */
export function getKecamatanSlugByApiId(
  apiId: string | number,
): string | null {
  const n =
    typeof apiId === "number"
      ? apiId
      : Number.parseInt(String(apiId).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return SLUG_BY_KECAMATAN_ID[n] ?? null;
}

/** ID numerik untuk API ringkasan/peringkat/tpk. */
export function getKecamatanApiId(slugOrId: string): string | null {
  const trimmed = slugOrId.trim();
  if (!trimmed) return null;

  const bySlug = KECAMATAN_ID_BY_SLUG[trimmed];
  if (bySlug != null) return String(bySlug);

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric > 0 && String(numeric) === trimmed) {
    return String(numeric);
  }

  return null;
}
