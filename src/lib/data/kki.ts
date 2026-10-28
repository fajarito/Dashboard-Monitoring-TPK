/**
 * Normalisasi KKI / kode_keluarga untuk join pin ↔ stunting_head.
 * Format dump tipikal: "11061020310200      001019026" (14 digit + 6 spasi + 9 digit).
 *
 * URL: `kki=32010110120011++++++003008009` → setelah decode form/`+` → 6 spasi.
 */

/** URL/`+` sering = spasi di query string; samakan dulu. */
export function spacesFromPlus(value: string): string {
  return value.replace(/\+/g, " ");
}

/** Deskripsi aman untuk diag (spasi terlihat sebagai `·`). */
export function describeKkiForDiag(value: string | null | undefined): {
  raw: string;
  visible: string;
  compact: string;
  paddedPrimary: string | null;
  length: number;
  spaceCount: number;
} {
  const raw = value ?? "";
  const spaced = spacesFromPlus(raw);
  const compact = compactKki(spaced);
  const paddedPrimary = primaryPaddedKki(spaced);
  return {
    raw,
    visible: spaced.replace(/ /g, "·"),
    compact,
    paddedPrimary,
    length: spaced.length,
    spaceCount: (spaced.match(/ /g) ?? []).length,
  };
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
 * Bentuk KKI dump tipikal (contoh Fajar):
 * `'11061020310200      001019026'` = 14 digit + **6 spasi** + sisa.
 *
 * **Selalu** rebuild dari compact — jangan andalkan jumlah `+`/spasi di URL.
 * Contoh OpenShift 404: `kki=32760110060018+001034036` (1 `+`) → tetap
 * `'32760110060018      001034036'` (6 spasi) setelah fungsi ini.
 */
export function primaryPaddedKki(value: string | null | undefined): string | null {
  const c = compactKki(value);
  if (c.length < 15) return null;
  return `${c.slice(0, 14)}${" ".repeat(6)}${c.slice(14)}`;
}

/** Jumlah spasi di antara blok 14 digit dan sisa (harus 6 untuk dump). */
export function countKkiInternalSpaces(value: string): number {
  const m = /^(\d{14})(\s+)(\d+)/.exec(spacesFromPlus(value).trim());
  return m ? m[2].length : 0;
}

/**
 * Normalisasi untuk lookup SQL: wajib bentuk padded primary 6 spasi.
 * Return null jika compact terlalu pendek.
 */
export function normalizeKkiForLookup(
  value: string | null | undefined,
): string | null {
  return primaryPaddedKki(value);
}

/**
 * Bentuk ber-spasi: padded 6 spasi (utama) + 1 spasi (sample minoritas).
 */
export function paddedKkiForms(compact: string): string[] {
  const c = compactKki(compact);
  if (!c) return [];
  const out: string[] = [];
  const primary = primaryPaddedKki(c);
  if (primary) out.push(primary);
  if (c.length >= 15) {
    out.push(`${c.slice(0, 14)} ${c.slice(14)}`);
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
