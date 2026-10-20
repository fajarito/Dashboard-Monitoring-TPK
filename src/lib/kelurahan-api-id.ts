/**
 * ID desa/kelurahan untuk route & API.
 * Tidak ada slug map mock (berbeda dari kab/kec Depok) — URL memakai id numerik.
 */

/** ID numerik positif untuk API ringkasan/tpk. */
export function getKelurahanApiId(slugOrId: string): string | null {
  const trimmed = slugOrId.trim();
  if (!trimmed) return null;

  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric > 0 && String(numeric) === trimmed) {
    return String(numeric);
  }

  return null;
}
