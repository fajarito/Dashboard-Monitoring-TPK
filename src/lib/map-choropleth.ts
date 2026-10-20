/**
 * Skala warna choropleth untuk Dashboard Monitoring TPK.
 * Default Jumlah TPK: sequential blues (icy → navy), 5 kelas —
 * selaras legenda referensi user. Tanpa teal→coral / ungu neon.
 */

import type { MetricKey } from "@/lib/map-data";
import { formatNumber } from "@/lib/map-data";
import type { MasterWilayahThematicDataItem } from "@/types/master-wilayah";

/**
 * Default Jumlah TPK — 5 kelas sequential biru:
 * pale icy cyan → light blue → medium royal → deep blue → navy.
 * Stop 1 sengaja cukup cyan (bukan hampir-putih) agar tidak terbaca
 * sebagai nodata abu di basemap Terang.
 */
export const CHOROPLETH_TPK = [
  "#b9e6fe",
  "#7dd3fc",
  "#3b82f6",
  "#1d4ed8",
  "#0c2340",
] as const;

/** Amber → coral — Jumlah KRS (metrik sekunder, tetap sequential). */
export const CHOROPLETH_KRS = [
  "#fef3c7",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#92400e",
] as const;

/** Deep navy → sky — rasio / beban (tetap di keluarga biru). */
export const CHOROPLETH_RASIO = [
  "#b9e6fe",
  "#38bdf8",
  "#0284c7",
  "#1d4ed8",
  "#0c2340",
] as const;

/** Netral (tanpa cast biru) — hanya untuk wilayah benar-benar tanpa metrik. */
export const CHOROPLETH_NO_DATA = "#e8edf2";

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

export function sdkPaletteForMetric(metric: ChoroplethMetric): SdkPaletteName {
  switch (metric) {
    case "krs":
      return "oranges";
    case "rasio":
      return "emerald";
    case "pkb":
    case "anggota":
    case "tpk":
    default:
      return "blues";
  }
}

/** Normalisasi nama wilayah untuk cocokkan poligon ↔ baris metrik. */
export function normalizeWilayahNama(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(
      /\b(provinsi|daerah istimewa|di|kabupaten|kota|kecamatan|desa|kelurahan|kel)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Hex steps dipakai saat mewarnai poligon client-side (sumber kebenaran). */
export function hexStepsForMetric(metric: ChoroplethMetric): readonly string[] {
  switch (metric) {
    case "krs":
      return CHOROPLETH_KRS;
    case "rasio":
      return CHOROPLETH_RASIO;
    default:
      return CHOROPLETH_TPK;
  }
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
  rasio?: number;
  /** Kode Kemendagri penuh untuk SDK (2/4/6/10 digit). */
  kode?: string | null;
};

export function metricValueFromRow(
  row: MetricRow,
  metric: ChoroplethMetric,
): number {
  switch (metric) {
    case "krs":
      return row.krs;
    case "pkb":
      return row.pkb ?? 0;
    case "rasio":
      return row.rasio ?? (row.tpk > 0 ? row.krs / row.tpk : 0);
    case "anggota":
      return row.tpk * 3;
    case "tpk":
    default:
      return row.tpk;
  }
}

export function metricUnitLabel(metric: ChoroplethMetric): string {
  switch (metric) {
    case "krs":
      return "keluarga";
    case "pkb":
      return "petugas";
    case "rasio":
      return "KRS/TPK";
    case "anggota":
      return "orang";
    case "tpk":
    default:
      return "tim";
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

/**
 * Default metrik peta = Jumlah TPK (sama default home / Peta Sebaran).
 * Rasio tersedia sebagai opsi sekunder.
 */
export const DEFAULT_MAP_METRIC: ChoroplethMetric = "tpk";

export function buildThematicData(
  rows: MetricRow[],
  metric: ChoroplethMetric,
  codeById: Map<string, string>,
): MasterWilayahThematicDataItem[] {
  const unit = metricUnitLabel(metric);
  const out: MasterWilayahThematicDataItem[] = [];
  for (const row of rows) {
    const code =
      (row.kode && String(row.kode).replace(/\D/g, "")) ||
      codeById.get(row.id) ||
      codeById.get(String(Number(row.id)));
    if (!code) continue;
    const value = metricValueFromRow(row, metric);
    out.push({
      code,
      value,
      name: row.nama,
      label: `${row.nama}: ${formatNumber(value)} ${unit}`.trim(),
    });
  }
  return out;
}

/**
 * Index thematic rows by Kemendagri code and exact normalized name.
 * Name index avoids gray fills when GeoJSON has DOB codes (93–96) that
 * must join even if a code string is oddly padded.
 */
export function indexThematicLookups(
  thematicData: MasterWilayahThematicDataItem[] | undefined | null,
): {
  byCode: Map<string, number>;
  byName: Map<string, number>;
} {
  const byCode = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const item of thematicData || []) {
    const code = String(item.code ?? "").replace(/\D/g, "");
    if (code && Number.isFinite(item.value)) {
      byCode.set(code, item.value);
      // Also index unpadded / zero-padded 2-digit forms for provinces.
      byCode.set(code.replace(/^0+/, "") || "0", item.value);
      if (code.length <= 2) {
        byCode.set(code.padStart(2, "0"), item.value);
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
  lookups: {
    byCode: Map<string, number>;
    byName: Map<string, number>;
  },
  code: string,
  name: string,
): number | null {
  const codeStr = String(code || "").replace(/\D/g, "");
  if (codeStr) {
    const fromCode =
      lookups.byCode.get(codeStr) ??
      lookups.byCode.get(codeStr.padStart(2, "0")) ??
      lookups.byCode.get(codeStr.replace(/^0+/, "") || "0");
    if (fromCode != null && Number.isFinite(fromCode)) return fromCode;
  }
  const key = normalizeWilayahNama(name || "");
  if (key) {
    const fromName = lookups.byName.get(key);
    if (fromName != null && Number.isFinite(fromName)) return fromName;
  }
  return null;
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
