/**
 * Validasi & normalisasi kode Kemendagri (Depdagri) untuk Master Wilayah map.
 * Panjang standar: provinsi 2, kab/kota 4, kecamatan 6, desa/kelurahan 10.
 */

export type KemendagriLevel =
  | "provinsi"
  | "kabupaten"
  | "kecamatan"
  | "desa";

const EXPECTED_LENGTH: Record<KemendagriLevel, number> = {
  provinsi: 2,
  kabupaten: 4,
  kecamatan: 6,
  desa: 10,
};

/** Ambil digit saja dari kode (buang titik/spasi). */
export function normalizeKemendagriDigits(
  code: string | null | undefined,
): string {
  return String(code ?? "").replace(/\D/g, "").trim();
}

export function expectedKemendagriLength(level: KemendagriLevel): number {
  return EXPECTED_LENGTH[level];
}

/**
 * True bila kode cocok panjang level (setelah normalisasi digit).
 * Menolak "0"/"00"… dan panjang salah — penyebab umum HTTP 500 MW thematic.
 */
export function isValidKemendagriCode(
  level: KemendagriLevel,
  code: string | null | undefined,
): boolean {
  const digits = normalizeKemendagriDigits(code);
  if (!digits) return false;
  if (digits.length !== EXPECTED_LENGTH[level]) return false;
  if (/^0+$/.test(digits)) return false;
  return true;
}

/** Normalisasi + validasi; null jika tidak layak dikirim ke MW API. */
export function sanitizeKemendagriCode(
  level: KemendagriLevel,
  code: string | null | undefined,
): string | null {
  const digits = normalizeKemendagriDigits(code);
  if (!isValidKemendagriCode(level, digits)) return null;
  if (level === "provinsi") return digits.padStart(2, "0").slice(-2);
  return digits;
}

/** Pesan UI dari error fetch/render Master Wilayah (HTTP 500/404/dll.). */
export function formatMasterWilayahRenderError(
  err: unknown,
  context?: { level?: string; code?: string | null; name?: string | null },
): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  const where =
    context?.name || context?.code
      ? ` untuk ${[context.name, context.code ? `(${context.code})` : ""]
          .filter(Boolean)
          .join(" ")
          .trim()}`
      : context?.level
        ? ` pada level ${context.level}`
        : "";

  if (lower.includes("http error 500") || /\b500\b/.test(raw)) {
    return (
      `Server Master Wilayah menolak permintaan batas wilayah${where}. ` +
      `Kode wilayah mungkin tidak valid atau data batas belum tersedia. ` +
      `Kembali ke level sebelumnya atau pilih wilayah lain.`
    );
  }
  if (lower.includes("http error 404") || /\b404\b/.test(raw)) {
    return (
      `Batas wilayah tidak ditemukan di Master Wilayah${where}. ` +
      `Wilayah ini mungkin belum punya geometri di API. ` +
      `Kembali ke level sebelumnya atau coba wilayah lain.`
    );
  }
  if (lower.includes("http error")) {
    return (
      `Gagal memuat batas wilayah dari Master Wilayah API${where}. ` +
      `(${raw}) Silakan coba lagi atau kembali ke level sebelumnya.`
    );
  }
  if (lower.includes("kode kemendagri") || lower.includes("kode wilayah")) {
    return raw;
  }
  return raw || "Gagal memuat batas wilayah dari Master Wilayah API.";
}
