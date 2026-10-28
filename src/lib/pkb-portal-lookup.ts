/**
 * Pure helpers untuk kunci lookup portal PKB (aman di client + server).
 * Fetch/token tetap di `pkb-portal.ts` (server-only).
 */

/** Jenis kunci query portal UAT. */
export type PkbPortalLookupKind = "nip" | "ktp";

export type PkbPortalLookupKey = {
  kind: PkbPortalLookupKind;
  /** Digit-only value untuk query (`NIP=` atau `ktp=`). */
  value: string;
};

/** Kode wilayah BPS (prov/kab/kec/kel) — jangan dikirim sebagai NIP. */
export function isWilayahCode(digits: string): boolean {
  return /^\d{2}$|^\d{4}$|^\d{6}$|^\d{8}$|^\d{10}$/.test(digits);
}

/** NIK/KTP Indonesia = 16 digit. */
export function isValidNikKtp(digits: string): boolean {
  return /^\d{16}$/.test(digits);
}

/**
 * NIP PNS klasik = 18 digit (YYYYMMDD + …).
 * Tolak kode wilayah / NIK 16 digit / PKBID pendek.
 */
export function isValidNipPns(digits: string): boolean {
  if (!/^\d{18}$/.test(digits)) return false;
  if (isWilayahCode(digits)) return false;
  const year = Number(digits.slice(0, 4));
  return year >= 1940 && year <= 2099;
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Prefer NIP 18-digit valid; else NIK/KTP 16-digit.
 * Tidak pernah mengembalikan kode wilayah (mis. 32010108).
 */
export function resolvePortalLookupKey(
  ...candidates: Array<string | null | undefined>
): PkbPortalLookupKey | null {
  const normalized: string[] = [];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    const digits = /^\d+$/.test(value) ? value : digitsOnly(value);
    if (!digits || isWilayahCode(digits)) continue;
    if (!normalized.includes(digits)) normalized.push(digits);
  }
  for (const digits of normalized) {
    if (isValidNipPns(digits)) return { kind: "nip", value: digits };
  }
  for (const digits of normalized) {
    if (isValidNikKtp(digits)) return { kind: "ktp", value: digits };
  }
  return null;
}

/**
 * Dari field TPK lokal: nip / pkbId / nik.
 * Resolve tetap prefer NIP 18d lalu KTP 16d.
 */
export function resolvePortalLookupFromPkb(pkb: {
  nip?: string | null;
  pkbId?: string | null;
  nik?: string | null;
} | null | undefined): PkbPortalLookupKey | null {
  if (!pkb) return null;
  return resolvePortalLookupKey(pkb.nip, pkb.pkbId, pkb.nik);
}

/** @deprecated pakai resolvePortalLookupKey. */
export function resolvePortalLookupNip(
  ...candidates: Array<string | null | undefined>
): string | null {
  const key = resolvePortalLookupKey(...candidates);
  return key ? key.value : null;
}

/**
 * Nama lokasi untuk query portal — UPPERCASE, bukan kode wilayah.
 * Null jika kosong / murni digit / kode BPS (2–10 digit).
 * Contoh valid: "BOJONG GEDE", "SUSUKAN", "JAWA BARAT".
 */
export function normalizePortalLokasiName(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const compact = value.replace(/[.\-\s]/g, "");
  if (/^\d+$/.test(compact) && compact.length <= 10) return null;
  if (isWilayahCode(compact)) return null;
  return value.toUpperCase();
}

export type PkbPortalLokasiNames = {
  propinsi?: string | null;
  kabupaten?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
};

/** Normalisasi 4 level lokasi → hanya nama string siap query portal. */
export function resolvePortalLokasiNames(
  input: PkbPortalLokasiNames | null | undefined,
): {
  propinsi: string;
  kabupaten: string;
  kecamatan: string;
  kelurahan: string;
} {
  return {
    propinsi: normalizePortalLokasiName(input?.propinsi) ?? "",
    kabupaten: normalizePortalLokasiName(input?.kabupaten) ?? "",
    kecamatan: normalizePortalLokasiName(input?.kecamatan) ?? "",
    kelurahan: normalizePortalLokasiName(input?.kelurahan) ?? "",
  };
}
