/**
 * Skala warna choropleth untuk Dashboard Monitoring TPK.
 * Sequential teal → emerald → amber → coral (profesional, terbaca di
 * basemap Terang/Satelit/Topo). Tanpa ungu neon / glow / abu seragam.
 */

import type { MetricKey } from "@/lib/map-data";
import { formatNumber } from "@/lib/map-data";
import type { MasterWilayahThematicDataItem } from "@/types/master-wilayah";

/**
 * Default Jumlah TPK — sequential berwarna (bukan slate/gray SDK).
 * Low = teal, mid = emerald/gold, high = amber → coral.
 */
export const CHOROPLETH_TPK = [
  "#5eead4",
  "#14b8a6",
  "#0f766e",
  "#ca8a04",
  "#ea580c",
  "#e11d48",
] as const;

/** Amber → coral — Jumlah KRS. */
export const CHOROPLETH_KRS = [
  "#fde68a",
  "#fbbf24",
  "#f59e0b",
  "#ea580c",
  "#e11d48",
  "#be123c",
] as const;

/** Deep navy → sky → gold — rasio / beban. */
export const CHOROPLETH_RASIO = [
  "#1e3a5f",
  "#0369a1",
  "#0ea5e9",
  "#38bdf8",
  "#fbbf24",
  "#d97706",
] as const;

/** Netral lembut untuk wilayah tanpa metrik — jangan dipakai untuk nilai 0 valid. */
export const CHOROPLETH_NO_DATA = "#e8eef4";

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
      // emerald lebih dekat teal/coral kit daripada blues (yang ujungnya slate abu)
      return "emerald";
  }
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
      label: `${row.nama}: ${formatNumber(value)} ${unit}`.trim(),
    });
  }
  return out;
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
const SELECTED_BORDER = "#0f766e";

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
