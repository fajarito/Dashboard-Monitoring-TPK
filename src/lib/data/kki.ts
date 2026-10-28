/**
 * Normalisasi KKI / kode_keluarga untuk join pin ↔ stunting_head.
 * Format dump tipikal: "11061020310200      001019026" (14 digit + spasi + 9 digit).
 */

/** URL/`+` sering = spasi di query string; samakan dulu. */
function spacesFromPlus(value: string): string {
  return value.replace(/\+/g, " ");
}

/** Compact key: buang semua whitespace. */
export function compactKki(value: string | null | undefined): string {
  if (!value) return "";
  return spacesFromPlus(value).replace(/\s+/g, "").trim();
}

/** Canonical display: trim + collapse internal whitespace ke satu spasi. */
export function canonicalKki(value: string | null | undefined): string {
  if (!value) return "";
  return spacesFromPlus(value).trim().replace(/\s+/g, " ");
}

/**
 * Bentuk ber-spasi seperti dump (14 + 6 spasi + sisa) — sering dipakai di stunting_head.
 * Juga bentuk 1 spasi (sample minoritas).
 */
export function paddedKkiForms(compact: string): string[] {
  const c = compactKki(compact);
  if (!c) return [];
  const out: string[] = [];
  if (c.length >= 15) {
    const head = c.slice(0, 14);
    const tail = c.slice(14);
    out.push(`${head}${" ".repeat(6)}${tail}`);
    out.push(`${head} ${tail}`);
  }
  return out;
}

/**
 * Kandidat string untuk equality match (bisa pakai index/btree pada `kki`).
 * Urutan: padded dump → 1 spasi → compact → raw trim.
 */
export function kkiMatchCandidates(value: string | null | undefined): string[] {
  const raw = spacesFromPlus(value ?? "").trim();
  const compact = compactKki(raw);
  if (!compact) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const p of paddedKkiForms(compact)) push(p);
  push(canonicalKki(raw));
  push(compact);
  if (raw) push(raw);
  return out;
}

export function kkiEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = compactKki(a);
  const right = compactKki(b);
  return Boolean(left) && left === right;
}
