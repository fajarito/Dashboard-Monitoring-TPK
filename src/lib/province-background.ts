/**
 * Katalog foto hero Peta Sebaran — Nusantara Fresh Blue.
 *
 * Aturan:
 * - Kode wilayah string (jaga leading zero). Nasional = "00".
 * - Drilldown kab/kec/desa → tetap pakai foto provinsi induk.
 * - Jangan pinjam foto provinsi lain / demo-landscape sebagai fallback.
 * - AI mockup boleh untuk prototyping, tapi harus ditandai — bukan foto dokumenter.
 */

import manifestJson from "../../public/backgrounds/background-manifest.json";

export type BackgroundManifestEntry = {
  code: string;
  province: string;
  slug: string;
  recommended_landmark: string;
  image: string | null;
  status: string;
  photo_credit: string | null;
  source_url: string | null;
  license: string | null;
};

export type ProvinceBackground = {
  code: string;
  province: string;
  slug: string;
  /** URL publik WebP, atau null → pakai CSS gradient. */
  imageUrl: string | null;
  /** Landmark yang direkomendasikan (bukan klaim lokasi foto). */
  recommendedLandmark: string;
  /** true = AI / belum diverifikasi — wajib badge placeholder. */
  isAiMockup: boolean;
  /** true = foto riil terverifikasi (credit/license lengkap). */
  isVerified: boolean;
  photoCredit: string | null;
  sourceUrl: string | null;
  license: string | null;
  status: string;
};

const NATIONAL_CODE = "00";

const manifest = manifestJson as BackgroundManifestEntry[];

const byCode = new Map<string, BackgroundManifestEntry>(
  manifest.map((entry) => [normalizeRegionCode(entry.code), entry]),
);

/** Normalisasi kode: string digit, jaga leading zero (2 digit; nasional "00"). */
export function normalizeRegionCode(code: string | number | null | undefined): string {
  if (code == null || code === "") return NATIONAL_CODE;
  const digits = String(code).replace(/\D/g, "");
  if (!digits) return NATIONAL_CODE;
  if (digits === "0" || digits === "00") return NATIONAL_CODE;
  return digits.padStart(2, "0").slice(-2);
}

function isMissingStatus(status: string): boolean {
  return /^MISSING/i.test(status.trim());
}

function isAiPlaceholderStatus(status: string): boolean {
  return /AI-generated|placeholder|not independently verified/i.test(status);
}

function isVerifiedStatus(status: string, entry: BackgroundManifestEntry): boolean {
  if (/verified/i.test(status) && !isAiPlaceholderStatus(status)) {
    return Boolean(entry.image && entry.photo_credit && entry.license);
  }
  return false;
}

/**
 * Resolusi kode hero dari state wilayah yang authoritative.
 * Kab/kec/desa → tetap kode provinsi induk (bukan ganti foto).
 */
export function resolveHeroRegionCode(input: {
  level?: "nasional" | "provinsi" | "kabupaten" | "kecamatan" | "desa" | string | null;
  provinceAdminCode?: string | number | null;
}): string {
  const level = input.level ?? "nasional";
  if (level === "nasional" || !input.provinceAdminCode) {
    return NATIONAL_CODE;
  }
  return normalizeRegionCode(input.provinceAdminCode);
}

/**
 * Ambil entry manifest + keputusan tampil foto.
 * imageUrl null → caller wajib fallback CSS fresh blue (bukan foto lain).
 */
export function getProvinceBackground(
  regionCode: string | number | null | undefined,
  entries: BackgroundManifestEntry[] = manifest,
): ProvinceBackground {
  const code = normalizeRegionCode(regionCode);
  const entry =
    entries.find((e) => normalizeRegionCode(e.code) === code) ??
    byCode.get(code) ??
    null;

  if (!entry) {
    return {
      code,
      province: code === NATIONAL_CODE ? "Nasional" : `Wilayah ${code}`,
      slug: code === NATIONAL_CODE ? "national" : `wilayah-${code}`,
      imageUrl: null,
      recommendedLandmark: "",
      isAiMockup: false,
      isVerified: false,
      photoCredit: null,
      sourceUrl: null,
      license: null,
      status: "MISSING - kode tidak ada di manifest",
    };
  }

  const missing = isMissingStatus(entry.status) || !entry.image;
  const ai = !missing && isAiPlaceholderStatus(entry.status);
  const verified = !missing && isVerifiedStatus(entry.status, entry);
  const imageUrl = missing ? null : entry.image;

  return {
    code: normalizeRegionCode(entry.code),
    province: entry.province,
    slug: entry.slug,
    imageUrl,
    recommendedLandmark: entry.recommended_landmark,
    isAiMockup: Boolean(ai),
    isVerified: Boolean(verified),
    photoCredit: entry.photo_credit,
    sourceUrl: entry.source_url,
    license: entry.license,
    status: entry.status,
  };
}

export function listBackgroundManifest(): BackgroundManifestEntry[] {
  return manifest.slice();
}

/** Gradient CSS fallback — fresh blue konsisten (bukan foto). */
export const FRESH_BLUE_GRADIENT =
  "linear-gradient(145deg, #E8F1FF 0%, #F5F9FF 42%, #DCE9FB 100%)";

/**
 * Soft fade → #F8FBFF di ujung bawah blok foto (judul+KPI saja).
 * Atas clear/saturated; bawah menyatu ke solid shell — bukan wash merata.
 */
export const FRESH_BLUE_HERO_OVERLAY_PHOTO =
  "linear-gradient(180deg, transparent 0%, transparent 40%, rgba(248,251,255,0.12) 58%, rgba(248,251,255,0.45) 72%, rgba(248,251,255,0.82) 88%, #f8fbff 100%)";

/** Mode tanpa foto: overlay tidak perlu — surface sudah gradient. */
export const FRESH_BLUE_HERO_OVERLAY_GRADIENT = "none";

/** @deprecated pakai FRESH_BLUE_HERO_OVERLAY_PHOTO */
export const FRESH_BLUE_HERO_OVERLAY = FRESH_BLUE_HERO_OVERLAY_PHOTO;
