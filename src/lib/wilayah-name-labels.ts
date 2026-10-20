/**
 * Label fallback & deteksi stub ID — aman untuk client + server.
 * Resolve nama asli (async) ada di `wilayah-display-name.ts`.
 */

/** Fallback singkat bila nama belum tersedia. */
export function kabNameFallback(apiId: string): string {
  return `Kabupaten/Kota (ID ${apiId})`;
}

export function kecNameFallback(apiId: string): string {
  return `Kecamatan (ID ${apiId})`;
}

export function kelNameFallback(apiId: string): string {
  return `Desa/Kelurahan (ID ${apiId})`;
}

/** True jika label masih stub ID (lama `Kabupaten/Kota 35` atau baru `(ID …)`). */
export function isUnresolvedKabName(name: string, apiId?: string): boolean {
  const trimmed = name.trim();
  if (/^Kabupaten\/Kota\s*\(\s*ID\s+\d+\s*\)$/i.test(trimmed)) return true;
  if (/^Kabupaten\/Kota\s+\d+$/i.test(trimmed)) return true;
  if (apiId && trimmed === `Kabupaten/Kota ${apiId}`) return true;
  if (apiId && trimmed === kabNameFallback(apiId)) return true;
  return false;
}

export function isUnresolvedKecName(name: string, apiId?: string): boolean {
  const trimmed = name.trim();
  if (/^Kecamatan\s*\(\s*ID\s+\d+\s*\)$/i.test(trimmed)) return true;
  if (/^Kecamatan\s+\d+$/i.test(trimmed)) return true;
  if (apiId && trimmed === `Kecamatan ${apiId}`) return true;
  if (apiId && trimmed === kecNameFallback(apiId)) return true;
  return false;
}

export function isUnresolvedKelName(name: string, apiId?: string): boolean {
  const trimmed = name.trim();
  if (/^Desa\/Kelurahan\s*\(\s*ID\s+\d+\s*\)$/i.test(trimmed)) return true;
  if (/^Desa\/Kelurahan\s+\d+$/i.test(trimmed)) return true;
  if (apiId && trimmed === `Desa/Kelurahan ${apiId}`) return true;
  if (apiId && trimmed === kelNameFallback(apiId)) return true;
  return false;
}
