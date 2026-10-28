/**
 * Normalisasi KKI / kode_keluarga untuk join pin ↔ stunting_head.
 * Format sample: "11061020310200      001019026" (spasi di tengah).
 */

/** Compact key: buang semua whitespace. */
export function compactKki(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, "").trim();
}

/** Canonical display: trim + collapse internal whitespace ke satu spasi. */
export function canonicalKki(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

export function kkiEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = compactKki(a);
  const right = compactKki(b);
  return Boolean(left) && left === right;
}
