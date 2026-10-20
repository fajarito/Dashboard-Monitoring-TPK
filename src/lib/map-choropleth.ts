/**
 * Skala warna choropleth untuk Dashboard Monitoring TPK.
 * Selaras token CSS (--primary, --chart-*, --navy) — biru/teal/amber tertahan,
 * tanpa ungu neon / glow.
 */

import type { MetricKey } from "@/lib/map-data";
import { formatNumber } from "@/lib/map-data";
import type { MasterWilayahThematicDataItem } from "@/types/master-wilayah";

/** Sequential blues — default Jumlah TPK (sama keluarga metrik nasional). */
export const CHOROPLETH_TPK = [
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#3b82f6",
  "#155eef",
  "#0b4dd8",
] as const;

/** Amber tertahan — Jumlah KRS. */
export const CHOROPLETH_KRS = [
  "#fef3c7",
  "#fde68a",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
] as const;

/** Teal — rasio / beban (diverging ringan dari netral ke teal dalam). */
export const CHOROPLETH_RASIO = [
  "#ccfbf1",
  "#99f6e4",
  "#5eead4",
  "#14b8a6",
  "#0f766e",
  "#115e59",
] as const;

export const CHOROPLETH_NO_DATA = "#e2e8f0";

/** Nama palette bawaan SDK Master Wilayah (paling dekat dengan token dashboard). */
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

/** Hex steps dipakai saat SDK tidak mewarnai (fallback layer style). */
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
