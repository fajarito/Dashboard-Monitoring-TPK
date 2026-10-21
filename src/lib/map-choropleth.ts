/**
 * Skala warna choropleth untuk Dashboard Monitoring TPK.
 *
 * Metrik UI (KPI switcher) → nilai pewarnaan peta:
 * - Jumlah TPK      → rasio KRS / TPK (beban: "1 TPK pegang N KRS")
 * - Jumlah Anggota  → jumlah personil (anggota)
 * - Jumlah PKB      → rasioPkbDesa (desa ÷ PKB)
 * - Jumlah KRS      → % KRS terhadap keluarga sasaran
 *
 * Palette: 5 kelas + noData (Sangat Rendah → Sangat Tinggi).
 */

import type { MetricKey } from "@/lib/map-data";
import { formatNumber, formatRatioValue } from "@/lib/map-data";
import type { MasterWilayahThematicDataItem } from "@/types/master-wilayah";

/** Urutan kelas choropleth (rendah → tinggi). */
export const CHOROPLETH_CLASS_KEYS = [
  "sangatRendah",
  "rendah",
  "sedang",
  "tinggi",
  "sangatTinggi",
] as const;

export type ChoroplethClassKey = (typeof CHOROPLETH_CLASS_KEYS)[number];

/** Label legenda — Sangat Rendah → Sangat Tinggi. */
export const CHOROPLETH_CLASS_LABELS = [
  "Sangat Rendah",
  "Rendah",
  "Sedang",
  "Tinggi",
  "Sangat Tinggi",
] as const;

/**
 * 5 kelas choropleth (Fajar):
 * sangatRendah → rendah → sedang → tinggi → sangatTinggi.
 */
export const CHOROPLETH_COLORS = {
  sangatRendah: "#D92D20",
  rendah: "#F79009",
  sedang: "#FEC84B",
  tinggi: "#12B76A",
  sangatTinggi: "#2E90FA",
  noData: "#D0D5DD",
} as const;

/** Hex steps dalam urutan kelas (sumber kebenaran pewarnaan client). */
export const CHOROPLETH_TPK = [
  CHOROPLETH_COLORS.sangatRendah,
  CHOROPLETH_COLORS.rendah,
  CHOROPLETH_COLORS.sedang,
  CHOROPLETH_COLORS.tinggi,
  CHOROPLETH_COLORS.sangatTinggi,
] as const;

/** Alias historis — semua mode memakai palette 5 kelas yang sama. */
export const CHOROPLETH_KRS = CHOROPLETH_TPK;
export const CHOROPLETH_RASIO = CHOROPLETH_TPK;

/** Netral — hanya untuk wilayah benar-benar tanpa metrik. */
export const CHOROPLETH_NO_DATA = CHOROPLETH_COLORS.noData;

/** Nama palette bawaan SDK Master Wilayah (mendekati arah warna kita). */
export type SdkPaletteName =
  | "blues"
  | "oranges"
  | "emerald"
  | "greens"
  | "reds"
  | "purples"
  | "viridis";

export type ChoroplethMetric = MetricKey | "rasio";

export function sdkPaletteForMetric(_metric: ChoroplethMetric): SdkPaletteName {
  // SDK fallback; warna sebenarnya dari hexStepsForMetric (client recolor).
  return "oranges";
}

/**
 * Alias nama resmi → bentuk short yang dipakai mock/UI.
 * Dipakai dua arah saat normalize agar DKI/DIY tetap cocok ke GeoJSON MW.
 */
const WILAYAH_NAME_ALIASES: Record<string, string> = {
  "daerah khusus ibukota jakarta": "dki jakarta",
  "khusus ibukota jakarta": "dki jakarta",
  "dki jakarta": "dki jakarta",
  jakarta: "dki jakarta",
  "daerah istimewa yogyakarta": "yogyakarta",
  "di yogyakarta": "yogyakarta",
  yogyakarta: "yogyakarta",
};

/** Normalisasi nama wilayah untuk cocokkan poligon ↔ baris metrik. */
export function normalizeWilayahNama(value: string): string {
  // Pertahankan kota vs kabupaten agar "Kota Bogor" ≠ "Kabupaten Bogor".
  let key = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(kab\.?|kabupaten)\b/g, "kabupaten")
    .replace(/\bkota\b/g, "kota")
    .replace(
      /\b(provinsi|daerah istimewa|daerah khusus ibukota|daerah khusus|di|dki|kecamatan|desa|kelurahan|kel)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  // Canonicalize known aliases (DKI / DIY) after stripping prefixes.
  const raw = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (WILAYAH_NAME_ALIASES[raw]) {
    key = WILAYAH_NAME_ALIASES[raw];
  } else if (WILAYAH_NAME_ALIASES[key]) {
    key = WILAYAH_NAME_ALIASES[key];
  } else if (key === "jakarta" || key === "ibukota jakarta") {
    key = "dki jakarta";
  }

  return key;
}

/** Hex steps dipakai saat mewarnai poligon client-side (sumber kebenaran). */
export function hexStepsForMetric(_metric: ChoroplethMetric): readonly string[] {
  return CHOROPLETH_TPK;
}

export function colorForValue(
  value: number | null | undefined,
  min: number,
  max: number,
  steps: readonly string[],
  noData = CHOROPLETH_NO_DATA,
): string {
  if (value == null || !Number.isFinite(value)) return noData;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return steps[Math.floor(steps.length / 2)] ?? noData;
  }
  const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const idx = Math.min(steps.length - 1, Math.floor(t * steps.length));
  return steps[idx] ?? noData;
}

export type MetricRow = {
  id: string;
  nama: string;
  tpk: number;
  krs: number;
  pkb?: number;
  /** Personil TPK (live SIGA COUNT anggota; mock province.anggota). */
  anggota?: number;
  /** Denominator DWH jumlah_keluarga_sasaran. */
  keluargaSasaran?: number;
  /** Desa/kelurahan binaan (SIGA) — numerator rasioPkbDesa. */
  desa?: number;
  /** KRS ÷ TPK (ranking lama). */
  rasio?: number;
  /** desa ÷ PKB — sama ranking rasioPkbDesa. */
  rasioPkbDesa?: number;
  /** Kode Kemendagri penuh untuk SDK (2/4/6/10 digit). */
  kode?: string | null;
};

/**
 * Nilai pewarnaan choropleth untuk mode switcher.
 * null = denominator kosong / metrik absen → nodata gray (bukan join miss).
 */
export function metricValueFromRow(
  row: MetricRow,
  metric: ChoroplethMetric,
): number | null {
  switch (metric) {
    case "tpk": {
      // Rasio TPK terhadap KRS → KRS / TPK (beban per tim)
      if (row.rasio != null && Number.isFinite(row.rasio) && row.rasio > 0) {
        return row.rasio;
      }
      if (row.tpk <= 0) return null;
      return row.krs / row.tpk;
    }
    case "anggota": {
      if (row.anggota != null && Number.isFinite(row.anggota)) {
        return row.anggota;
      }
      return null;
    }
    case "pkb": {
      // Sama konsep ranking rasioPkbDesa = desa ÷ PKB
      if (row.rasioPkbDesa != null && Number.isFinite(row.rasioPkbDesa)) {
        return row.rasioPkbDesa;
      }
      const pkb = row.pkb ?? 0;
      const desa = row.desa ?? 0;
      if (pkb <= 0) return null;
      return desa / pkb;
    }
    case "krs": {
      // % KRS terhadap Jumlah Keluarga Sasaran
      const denom = row.keluargaSasaran ?? 0;
      if (denom <= 0) return null;
      return (row.krs / denom) * 100;
    }
    case "rasio":
      return row.rasio ?? (row.tpk > 0 ? row.krs / row.tpk : null);
    default:
      return row.tpk;
  }
}

export function metricUnitLabel(metric: ChoroplethMetric): string {
  switch (metric) {
    case "krs":
      return "% KRS/sasaran";
    case "pkb":
      return "desa/PKB";
    case "rasio":
    case "tpk":
      return "KRS/TPK";
    case "anggota":
      return "orang";
    default:
      return "";
  }
}

export function metricDisplayLabel(metric: ChoroplethMetric): string {
  switch (metric) {
    case "krs":
      return "Jumlah KRS";
    case "pkb":
      return "Jumlah PKB";
    case "rasio":
      return "Rasio KRS / TPK";
    case "anggota":
      return "Jumlah Anggota TPK";
    case "tpk":
    default:
      return "Jumlah TPK";
  }
}

/** Label rumus pewarnaan (untuk legenda / tooltip peta). */
export function choroplethFormulaLabel(metric: ChoroplethMetric): string {
  switch (metric) {
    case "tpk":
      return "Rasio TPK terhadap KRS";
    case "anggota":
      return "Jumlah personil (anggota TPK)";
    case "pkb":
      return "Rasio PKB terhadap Desa";
    case "krs":
      return "Persentase KRS terhadap Keluarga Sasaran";
    case "rasio":
      return "Rasio TPK terhadap KRS";
    default:
      return metricDisplayLabel(metric);
  }
}

/**
 * Format nilai choropleth untuk display singkat (legenda SDK / fallback).
 * Hover manusiawi memakai formatHoverPrimary / formatChoroplethHover.
 */
export function formatChoroplethValue(
  value: number,
  metric: ChoroplethMetric,
): string {
  switch (metric) {
    case "tpk":
    case "rasio":
      return formatNumber(Math.round(value));
    case "pkb":
      return formatRatioValue(value, 1);
    case "krs":
      return `${formatRatioValue(value, 1)}%`;
    case "anggota":
    default:
      return formatNumber(value);
  }
}

/** Teks hover utama dari nilai numerik choropleth (tanpa baris penuh). */
export function formatChoroplethHover(
  value: number,
  metric: ChoroplethMetric,
): string {
  switch (metric) {
    case "tpk":
    case "rasio":
      return `1 TPK pegang ${formatNumber(Math.round(value))} KRS`;
    case "pkb":
      return `1 PKB ${formatRatioValue(value, 1)} Desa`;
    case "krs":
      return `${formatRatioValue(value, 1)}%`;
    case "anggota":
      return `${formatNumber(value)} orang`;
    default:
      return formatChoroplethValue(value, metric);
  }
}

/**
 * Teks hover utama dari baris metrik live (lebih akurat untuk counts).
 * null bila denominator kosong.
 */
export function formatHoverPrimary(
  row: MetricRow,
  metric: ChoroplethMetric,
): string | null {
  switch (metric) {
    case "tpk":
    case "rasio": {
      if (row.tpk <= 0) return null;
      const n = Math.round(row.krs / row.tpk);
      return `1 TPK pegang ${formatNumber(n)} KRS`;
    }
    case "pkb": {
      const value = metricValueFromRow(row, "pkb");
      if (value == null) return null;
      return `1 PKB ${formatRatioValue(value, 1)} Desa`;
    }
    case "krs": {
      const value = metricValueFromRow(row, "krs");
      if (value == null) return null;
      return `${formatRatioValue(value, 1)}%`;
    }
    case "anggota": {
      const value = metricValueFromRow(row, "anggota");
      if (value == null) return null;
      return `${formatNumber(value)} orang`;
    }
    default:
      return null;
  }
}

/**
 * Default metrik peta = Jumlah TPK (sama default home / Peta Sebaran).
 * Pewarnaan memakai rasio KRS/TPK — selaras copy hover.
 */
export const DEFAULT_MAP_METRIC: ChoroplethMetric = "tpk";

export function buildThematicData(
  rows: MetricRow[],
  metric: ChoroplethMetric,
  codeById: Map<string, string>,
): MasterWilayahThematicDataItem[] {
  const out: MasterWilayahThematicDataItem[] = [];
  for (const row of rows) {
    const code =
      (row.kode && String(row.kode).replace(/\D/g, "")) ||
      codeById.get(row.id) ||
      codeById.get(String(Number(row.id))) ||
      "";
    const value = metricValueFromRow(row, metric);
    // Tetap emit baris bila ada kode ATAU nama — name-join menutup gap kode.
    // value null (denom 0) tidak di-index sebagai angka → nodata gray setelah join.
    if (!code && !row.nama) continue;
    if (value == null || !Number.isFinite(value)) continue;
    const hover = formatHoverPrimary(row, metric) ?? formatChoroplethHover(value, metric);
    out.push({
      code: code || `name:${normalizeWilayahNama(row.nama)}`,
      value,
      name: row.nama,
      label: `${row.nama}: ${hover}`,
    });
  }
  return out;
}

export type ThematicLookups = {
  byCode: Map<string, number>;
  byName: Map<string, number>;
};

/**
 * Index thematic rows by Kemendagri code and exact normalized name.
 * Name index menghindari gray fill bila kode poligon beda padding / DOB.
 */
export function indexThematicLookups(
  thematicData: MasterWilayahThematicDataItem[] | undefined | null,
): ThematicLookups {
  const byCode = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const item of thematicData || []) {
    const code = String(item.code ?? "").replace(/\D/g, "");
    if (code && Number.isFinite(item.value)) {
      byCode.set(code, item.value);
      byCode.set(code.replace(/^0+/, "") || "0", item.value);
      if (code.length <= 2) {
        byCode.set(code.padStart(2, "0"), item.value);
      }
      if (code.length <= 4) {
        byCode.set(code.padStart(4, "0"), item.value);
      }
      if (code.length <= 6) {
        byCode.set(code.padStart(6, "0"), item.value);
      }
    }
    const rawName =
      item.name ||
      (typeof item.label === "string" ? item.label.split(":")[0] : "") ||
      "";
    const key = normalizeWilayahNama(rawName);
    if (key && Number.isFinite(item.value) && !byName.has(key)) {
      byName.set(key, item.value);
    }
  }
  return { byCode, byName };
}

export function lookupThematicValue(
  lookups: ThematicLookups,
  code: string,
  name: string,
): number | null {
  const codeStr = String(code || "").replace(/\D/g, "");
  if (codeStr) {
    const candidates = [
      codeStr,
      codeStr.padStart(2, "0"),
      codeStr.padStart(4, "0"),
      codeStr.padStart(6, "0"),
      codeStr.padStart(10, "0"),
      codeStr.replace(/^0+/, "") || "0",
    ];
    for (const c of candidates) {
      const fromCode = lookups.byCode.get(c);
      if (fromCode != null && Number.isFinite(fromCode)) return fromCode;
    }
  }
  const key = normalizeWilayahNama(name || "");
  if (key) {
    const fromName = lookups.byName.get(key);
    if (fromName != null && Number.isFinite(fromName)) return fromName;
  }
  return null;
}

/** Cari baris metrik live by kode Kemendagri atau nama exact. */
export function lookupMetricRow(
  rows: MetricRow[] | undefined | null,
  code: string,
  name: string,
): MetricRow | null {
  if (!rows?.length) return null;
  const cleanCode = String(code || "").replace(/\D/g, "").trim();
  const nameKey = normalizeWilayahNama(name || "");

  if (cleanCode) {
    const byCode = rows.find((row) => {
      const kode = String(row.kode || "").replace(/\D/g, "");
      if (!kode) return false;
      return (
        kode === cleanCode ||
        kode === cleanCode.padStart(kode.length, "0") ||
        cleanCode === kode.padStart(cleanCode.length, "0") ||
        kode.replace(/^0+/, "") === cleanCode.replace(/^0+/, "")
      );
    });
    if (byCode) return byCode;
  }

  if (nameKey) {
    const byName = rows.find(
      (row) => normalizeWilayahNama(row.nama) === nameKey,
    );
    if (byName) return byName;
  }
  return null;
}

/**
 * Audit join miss: poligon punya data di thematic rows (by name/code intent)
 * tetapi lookup gagal. Dipakai smoke / dev log.
 */
export function auditUnmatchedFeatures(
  features: Array<{ code?: string; name?: string }>,
  lookups: ThematicLookups,
): { matched: number; unmatched: Array<{ code: string; name: string }> } {
  const unmatched: Array<{ code: string; name: string }> = [];
  let matched = 0;
  for (const feat of features) {
    const code = String(feat.code || "").replace(/\D/g, "");
    const name = String(feat.name || "");
    const val = lookupThematicValue(lookups, code, name);
    if (val == null) unmatched.push({ code, name });
    else matched += 1;
  }
  return { matched, unmatched };
}

/** Compose kode penuh dari segmen Depdagri di MV pk2025. */
export function composeKemendagriCode(parts: {
  prov?: string | null;
  kab?: string | null;
  kec?: string | null;
  kel?: string | null;
}): string | null {
  const prov = String(parts.prov ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0")
    .slice(-2);
  if (!prov || prov === "00") return null;

  const kab = String(parts.kab ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0")
    .slice(-2);
  if (!parts.kab) return prov;

  const kec = String(parts.kec ?? "")
    .replace(/\D/g, "")
    .padStart(2, "0")
    .slice(-2);
  if (!parts.kec) return `${prov}${kab}`;

  const kel = String(parts.kel ?? "")
    .replace(/\D/g, "")
    .padStart(4, "0")
    .slice(-4);
  if (!parts.kel) return `${prov}${kab}${kec}`;

  return `${prov}${kab}${kec}${kel}`;
}

/** Style path Leaflet yang kita kendalikan (base + hover). */
export type ChoroplethPathStyle = {
  fillColor: string;
  fillOpacity: number;
  weight: number;
  color: string;
  opacity: number;
};

const HOVER_BORDER = "#0f172a";
const BASE_BORDER = "#ffffff";
const SELECTED_BORDER = "#1d4ed8";

/**
 * Walk boundaryGroup → nested GeoJSON → path layers that have `.feature`.
 * SDK menaruh tiap poligon di L.geoJSON(feature) di dalam FeatureGroup,
 * jadi eachLayer tingkat atas TIDAK punya `.feature` / properties.
 */
export function forEachPolygonLayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visit: (layer: any) => void,
  depth = 0,
): void {
  if (!group || typeof group.eachLayer !== "function" || depth > 6) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group.eachLayer((layer: any) => {
    if (layer?.feature?.properties) {
      visit(layer);
      return;
    }
    if (typeof layer?.eachLayer === "function") {
      forEachPolygonLayer(layer, visit, depth + 1);
    }
  });
}

export function buildBasePathStyle(
  fillColor: string,
  hasThematic: boolean,
): ChoroplethPathStyle {
  return {
    fillColor,
    fillOpacity: hasThematic ? 0.82 : 0.4,
    weight: 1.15,
    color: BASE_BORDER,
    opacity: 0.95,
  };
}

export function buildHoverPathStyle(
  base: ChoroplethPathStyle,
): ChoroplethPathStyle {
  return {
    ...base,
    weight: base.weight + 1.6,
    color: HOVER_BORDER,
    fillOpacity: Math.min(1, base.fillOpacity + 0.12),
    opacity: 1,
  };
}

export function buildSelectedPathStyle(
  fillColor: string,
): ChoroplethPathStyle {
  return {
    fillColor,
    fillOpacity: 0.92,
    weight: 3.25,
    color: SELECTED_BORDER,
    opacity: 1,
  };
}
