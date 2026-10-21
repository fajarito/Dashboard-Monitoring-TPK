/**
 * Spesifikasi indikator peta Monitoring TPK (Fajar, docs/map-indicator-spec.md).
 * Threshold tetap untuk TPK/KRS, PKB/desa, %KRS; anggota = kuantil level admin.
 */

import type { ChoroplethMetric, MetricRow } from "@/lib/map-choropleth";
import { formatNumber, formatRatioValue } from "@/lib/map-data";

/** Palet spek — beban rendah = baik (biru), beban tinggi = merah. */
export const INDICATOR_COLORS = {
  sangatBaik: "#2E90FA",
  ideal: "#12B76A",
  waspada: "#FEC84B",
  berat: "#F79009",
  sangatBerat: "#D92D20",
  /** Sebaran anggota: sedikit → banyak */
  sangatSedikit: "#D92D20",
  sedikit: "#F79009",
  sedang: "#FEC84B",
  banyak: "#12B76A",
  sangatBanyak: "#2E90FA",
  noData: "#D0D5DD",
  /** Denom 0 + numerator > 0 — perhatian, bukan Sangat Baik */
  attention: "#D92D20",
} as const;

export type IndicatorStatus = "ok" | "attention" | "noData";

export type IndicatorClassification = {
  value: number | null;
  category: string;
  color: string;
  keterangan: string;
  status: IndicatorStatus;
};

export type LegendItem = {
  label: string;
  color: string;
  range: string;
};

export type IndicatorClassifyOptions = {
  /** Numerator mentah (KRS / desa / anggota) — untuk aturan denom 0. */
  numerator?: number;
  /** Denominator mentah (TPK / PKB / keluarga sasaran). */
  denominator?: number;
  /** 4 batas kuantil (20/40/60/80) untuk metrik anggota. */
  quintileBreaks?: number[];
};

/** Nama indikator (judul legenda / tooltip). */
export function indicatorTitle(metric: ChoroplethMetric): string {
  switch (metric) {
    case "tpk":
    case "rasio":
      return "Rasio TPK terhadap KRS";
    case "anggota":
      return "Sebaran Anggota TPK";
    case "pkb":
      return "Rasio PKB terhadap Desa Binaan";
    case "krs":
      return "Persentase KRS terhadap Keluarga Sasaran";
    default:
      return "Indikator peta";
  }
}

/**
 * Hitung 4 batas kuantil (p20, p40, p60, p80) dari nilai aktual level admin.
 * Duplikat diizinkan — kelas bisa menyempit bila data homogen.
 */
export function getQuintileBreaks(values: number[]): number[] {
  const sorted = values
    .filter((v) => Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  if (sorted.length === 1) {
    const v = sorted[0]!;
    return [v, v, v, v];
  }
  const at = (q: number) => {
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil(sorted.length * q) - 1),
    );
    return sorted[idx]!;
  };
  return [at(0.2), at(0.4), at(0.6), at(0.8)];
}

function classifyByAscendingBreaks(
  value: number,
  breaks: number[],
  labels: readonly [string, string, string, string, string],
  colors: readonly [string, string, string, string, string],
  keterangan: readonly [string, string, string, string, string],
): IndicatorClassification {
  const b0 = breaks[0] ?? value;
  const b1 = breaks[1] ?? b0;
  const b2 = breaks[2] ?? b1;
  const b3 = breaks[3] ?? b2;
  let idx = 4;
  if (value <= b0) idx = 0;
  else if (value <= b1) idx = 1;
  else if (value <= b2) idx = 2;
  else if (value <= b3) idx = 3;
  return {
    value,
    category: labels[idx]!,
    color: colors[idx]!,
    keterangan: keterangan[idx]!,
    status: "ok",
  };
}

/** Klasifikasi TPK: KRS per TPK — threshold tetap. */
function classifyTpk(value: number): IndicatorClassification {
  if (value <= 50) {
    return {
      value,
      category: "Sangat Baik",
      color: INDICATOR_COLORS.sangatBaik,
      keterangan: "Beban pendampingan relatif ringan.",
      status: "ok",
    };
  }
  if (value <= 100) {
    return {
      value,
      category: "Ideal",
      color: INDICATOR_COLORS.ideal,
      keterangan: "Beban pendampingan dalam batas ideal (maks. 100 KRS/TPK).",
      status: "ok",
    };
  }
  if (value <= 125) {
    return {
      value,
      category: "Waspada",
      color: INDICATOR_COLORS.waspada,
      keterangan: "Beban pendampingan mulai meningkat.",
      status: "ok",
    };
  }
  if (value <= 150) {
    return {
      value,
      category: "Berat",
      color: INDICATOR_COLORS.berat,
      keterangan: "Beban pendampingan tinggi.",
      status: "ok",
    };
  }
  return {
    value,
    category: "Sangat Berat",
    color: INDICATOR_COLORS.sangatBerat,
    keterangan: "Beban pendampingan sangat tinggi.",
    status: "ok",
  };
}

/** Klasifikasi PKB: desa per PKB — threshold tetap. */
function classifyPkb(value: number): IndicatorClassification {
  if (value <= 1) {
    return {
      value,
      category: "Sangat Baik",
      color: INDICATOR_COLORS.sangatBaik,
      keterangan: "Beban pembinaan sangat ringan.",
      status: "ok",
    };
  }
  if (value <= 2) {
    return {
      value,
      category: "Ideal",
      color: INDICATOR_COLORS.ideal,
      keterangan: "Beban pembinaan dalam rasio ideal (maks. 2 desa/PKB).",
      status: "ok",
    };
  }
  if (value <= 3) {
    return {
      value,
      category: "Waspada",
      color: INDICATOR_COLORS.waspada,
      keterangan: "Beban pembinaan mendekati batas.",
      status: "ok",
    };
  }
  if (value <= 4) {
    return {
      value,
      category: "Berat",
      color: INDICATOR_COLORS.berat,
      keterangan: "Beban pembinaan melebihi rasio ideal.",
      status: "ok",
    };
  }
  return {
    value,
    category: "Sangat Berat",
    color: INDICATOR_COLORS.sangatBerat,
    keterangan: "Beban pembinaan sangat tinggi.",
    status: "ok",
  };
}

/** Klasifikasi % KRS — threshold tetap. */
function classifyKrsPct(value: number): IndicatorClassification {
  if (value < 10) {
    return {
      value,
      category: "Sangat Baik",
      color: INDICATOR_COLORS.sangatBaik,
      keterangan: "Persentase KRS sangat rendah.",
      status: "ok",
    };
  }
  if (value < 20) {
    return {
      value,
      category: "Ideal",
      color: INDICATOR_COLORS.ideal,
      keterangan: "Persentase KRS di bawah target 20%.",
      status: "ok",
    };
  }
  if (value < 25) {
    return {
      value,
      category: "Waspada",
      color: INDICATOR_COLORS.waspada,
      keterangan: "Persentase KRS telah mencapai ambang 20%.",
      status: "ok",
    };
  }
  if (value < 30) {
    return {
      value,
      category: "Tinggi",
      color: INDICATOR_COLORS.berat,
      keterangan: "Persentase KRS tinggi.",
      status: "ok",
    };
  }
  return {
    value,
    category: "Sangat Tinggi",
    color: INDICATOR_COLORS.sangatBerat,
    keterangan: "Persentase KRS sangat tinggi.",
    status: "ok",
  };
}

const ANGGOTA_LABELS = [
  "Sangat Sedikit",
  "Sedikit",
  "Sedang",
  "Banyak",
  "Sangat Banyak",
] as const;

const ANGGOTA_COLORS = [
  INDICATOR_COLORS.sangatSedikit,
  INDICATOR_COLORS.sedikit,
  INDICATOR_COLORS.sedang,
  INDICATOR_COLORS.banyak,
  INDICATOR_COLORS.sangatBanyak,
] as const;

const ANGGOTA_KETERANGAN = [
  "Jumlah anggota relatif sangat sedikit di level ini.",
  "Jumlah anggota relatif sedikit di level ini.",
  "Jumlah anggota berada di rentang sedang.",
  "Jumlah anggota relatif banyak di level ini.",
  "Jumlah anggota relatif sangat banyak di level ini.",
] as const;

function noDataResult(keterangan = "Data tidak tersedia."): IndicatorClassification {
  return {
    value: null,
    category: "Tidak Ada Data",
    color: INDICATOR_COLORS.noData,
    keterangan,
    status: "noData",
  };
}

function attentionResult(
  numerator: number,
  denominatorLabel: string,
): IndicatorClassification {
  return {
    value: null,
    category: "Tidak ada petugas/kelompok",
    color: INDICATOR_COLORS.attention,
    keterangan: `Ada ${formatNumber(numerator)} tanpa ${denominatorLabel} (denominator 0).`,
    status: "attention",
  };
}

/**
 * Nilai numerik indikator dari baris (sum/sum per wilayah).
 * null = tidak bisa dihitung (bukan attention — cek lewat classifyRow).
 */
export function indicatorValueFromRow(
  row: MetricRow,
  metric: ChoroplethMetric,
): number | null {
  switch (metric) {
    case "tpk":
    case "rasio": {
      if (row.tpk <= 0) return null;
      if (row.rasio != null && Number.isFinite(row.rasio) && row.rasio > 0) {
        return row.rasio;
      }
      return row.krs / row.tpk;
    }
    case "anggota": {
      if (row.anggota == null || !Number.isFinite(row.anggota)) return null;
      return row.anggota;
    }
    case "pkb": {
      if (row.rasioPkbDesa != null && Number.isFinite(row.rasioPkbDesa)) {
        const pkb = row.pkb ?? 0;
        if (pkb <= 0) return null;
        return row.rasioPkbDesa;
      }
      const pkb = row.pkb ?? 0;
      const desa = row.desa ?? 0;
      if (pkb <= 0) return null;
      return desa / pkb;
    }
    case "krs": {
      const denom = row.keluargaSasaran ?? 0;
      if (denom <= 0) return null;
      return (row.krs / denom) * 100;
    }
    default:
      return null;
  }
}

/** Klasifikasi dari nilai + opsi denom (fungsi terpusat spek). */
export function getIndicatorCategory(
  metric: ChoroplethMetric,
  value: number | null | undefined,
  options: IndicatorClassifyOptions = {},
): IndicatorClassification {
  const numerator = options.numerator;
  const denominator = options.denominator;

  if (metric === "tpk" || metric === "rasio") {
    if (denominator != null && denominator <= 0) {
      if (numerator != null && numerator > 0) {
        return attentionResult(numerator, "TPK (kelompok)");
      }
      return noDataResult();
    }
    if (value == null || !Number.isFinite(value)) return noDataResult();
    return classifyTpk(value);
  }

  if (metric === "pkb") {
    if (denominator != null && denominator <= 0) {
      if (numerator != null && numerator > 0) {
        return attentionResult(numerator, "PKB");
      }
      return noDataResult();
    }
    if (value == null || !Number.isFinite(value)) return noDataResult();
    return classifyPkb(value);
  }

  if (metric === "krs") {
    if (denominator != null && denominator <= 0) {
      return noDataResult("Keluarga sasaran tidak tersedia.");
    }
    if (value == null || !Number.isFinite(value)) return noDataResult();
    return classifyKrsPct(value);
  }

  if (metric === "anggota") {
    if (value == null || !Number.isFinite(value)) {
      return noDataResult("Data tidak tersedia.");
    }
    const breaks = options.quintileBreaks ?? [];
    if (breaks.length < 4) {
      // Tanpa batas kuantil — tengah spektrum
      return {
        value,
        category: "Sedang",
        color: INDICATOR_COLORS.sedang,
        keterangan: ANGGOTA_KETERANGAN[2],
        status: "ok",
      };
    }
    return classifyByAscendingBreaks(
      value,
      breaks,
      ANGGOTA_LABELS,
      ANGGOTA_COLORS,
      ANGGOTA_KETERANGAN,
    );
  }

  return noDataResult();
}

export function getIndicatorColor(
  metric: ChoroplethMetric,
  value: number | null | undefined,
  options: IndicatorClassifyOptions = {},
): string {
  return getIndicatorCategory(metric, value, options).color;
}

/** Klasifikasi langsung dari baris metrik live. */
export function classifyMetricRow(
  row: MetricRow,
  metric: ChoroplethMetric,
  quintileBreaks?: number[],
): IndicatorClassification {
  switch (metric) {
    case "tpk":
    case "rasio":
      return getIndicatorCategory(metric, indicatorValueFromRow(row, metric), {
        numerator: row.krs,
        denominator: row.tpk,
      });
    case "pkb":
      return getIndicatorCategory(metric, indicatorValueFromRow(row, metric), {
        numerator: row.desa ?? 0,
        denominator: row.pkb ?? 0,
      });
    case "krs":
      return getIndicatorCategory(metric, indicatorValueFromRow(row, metric), {
        numerator: row.krs,
        denominator: row.keluargaSasaran ?? 0,
      });
    case "anggota":
      return getIndicatorCategory(metric, indicatorValueFromRow(row, metric), {
        quintileBreaks,
      });
    default:
      return noDataResult();
  }
}

/** Format nilai utama tooltip (contoh spek). */
export function formatIndicatorValue(
  metric: ChoroplethMetric,
  value: number | null,
  row?: MetricRow | null,
): string {
  if (metric === "anggota") {
    if (row) {
      const tpk = formatNumber(row.tpk);
      const anggota =
        row.anggota != null ? formatNumber(row.anggota) : "tidak tersedia";
      return `Jumlah TPK: ${tpk} Kelompok · Jumlah Anggota TPK: ${anggota} Orang`;
    }
    if (value == null) return "Data tidak tersedia";
    return `Jumlah Anggota TPK: ${formatNumber(value)} Orang`;
  }

  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  switch (metric) {
    case "tpk":
    case "rasio":
      return `1 TPK : ${formatNumber(Math.round(value))} KRS`;
    case "pkb":
      return `1 PKB : ${formatRatioValue(value, 1)} Desa`;
    case "krs":
      return `${formatRatioValue(value, 1)}% dari Keluarga Sasaran`;
    default:
      return formatNumber(value);
  }
}

function formatIdRangeBound(n: number, digits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Item legenda dinamis — 5 kelas + Tidak Ada Data. */
export function getLegendItems(
  metric: ChoroplethMetric,
  options: { quintileBreaks?: number[]; values?: number[] } = {},
): LegendItem[] {
  const noData: LegendItem = {
    label: "Tidak Ada Data",
    color: INDICATOR_COLORS.noData,
    range: "—",
  };

  if (metric === "tpk" || metric === "rasio") {
    return [
      {
        label: "Sangat Baik",
        color: INDICATOR_COLORS.sangatBaik,
        range: "≤ 50 KRS/TPK",
      },
      {
        label: "Ideal",
        color: INDICATOR_COLORS.ideal,
        range: "> 50 – 100",
      },
      {
        label: "Waspada",
        color: INDICATOR_COLORS.waspada,
        range: "> 100 – 125",
      },
      {
        label: "Berat",
        color: INDICATOR_COLORS.berat,
        range: "> 125 – 150",
      },
      {
        label: "Sangat Berat",
        color: INDICATOR_COLORS.sangatBerat,
        range: "> 150",
      },
      noData,
    ];
  }

  if (metric === "pkb") {
    return [
      {
        label: "Sangat Baik",
        color: INDICATOR_COLORS.sangatBaik,
        range: "≤ 1 desa/PKB",
      },
      {
        label: "Ideal",
        color: INDICATOR_COLORS.ideal,
        range: "> 1 – 2",
      },
      {
        label: "Waspada",
        color: INDICATOR_COLORS.waspada,
        range: "> 2 – 3",
      },
      {
        label: "Berat",
        color: INDICATOR_COLORS.berat,
        range: "> 3 – 4",
      },
      {
        label: "Sangat Berat",
        color: INDICATOR_COLORS.sangatBerat,
        range: "> 4",
      },
      noData,
    ];
  }

  if (metric === "krs") {
    return [
      {
        label: "Sangat Baik",
        color: INDICATOR_COLORS.sangatBaik,
        range: "< 10%",
      },
      {
        label: "Ideal",
        color: INDICATOR_COLORS.ideal,
        range: "≥ 10% – < 20%",
      },
      {
        label: "Waspada",
        color: INDICATOR_COLORS.waspada,
        range: "≥ 20% – < 25%",
      },
      {
        label: "Tinggi",
        color: INDICATOR_COLORS.berat,
        range: "≥ 25% – < 30%",
      },
      {
        label: "Sangat Tinggi",
        color: INDICATOR_COLORS.sangatBerat,
        range: "≥ 30%",
      },
      noData,
    ];
  }

  // Anggota — rentang kuantil aktual
  const breaks =
    options.quintileBreaks ??
    (options.values?.length ? getQuintileBreaks(options.values) : []);
  if (breaks.length < 4) {
    return [
      ...ANGGOTA_LABELS.map((label, i) => ({
        label,
        color: ANGGOTA_COLORS[i]!,
        range: "—",
      })),
      noData,
    ];
  }
  const [b0, b1, b2, b3] = breaks as [number, number, number, number];
  const ranges = [
    `≤ ${formatIdRangeBound(b0)}`,
    `${formatIdRangeBound(b0)} – ${formatIdRangeBound(b1)}`,
    `${formatIdRangeBound(b1)} – ${formatIdRangeBound(b2)}`,
    `${formatIdRangeBound(b2)} – ${formatIdRangeBound(b3)}`,
    `> ${formatIdRangeBound(b3)}`,
  ];
  return [
    ...ANGGOTA_LABELS.map((label, i) => ({
      label,
      color: ANGGOTA_COLORS[i]!,
      range: ranges[i]!,
    })),
    noData,
  ];
}

/** Warna fill path dari klasifikasi (termasuk attention). */
export function colorForIndicatorClassification(
  classification: IndicatorClassification,
): string {
  return classification.color;
}
