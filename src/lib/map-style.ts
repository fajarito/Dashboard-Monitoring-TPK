import {
  getMapBreaks,
  type MetricKey,
} from "@/lib/map-data";
import { mapNoDataColor, mapPalette } from "@/lib/navigation";

export function getMapFillExpression(metric: MetricKey) {
  const breaks = getMapBreaks(metric);
  // 4 kelas → 3 batas
  const b0 = breaks[0] ?? 0;
  const b1 = breaks[1] ?? b0;
  const b2 = breaks[2] ?? b1;
  return [
    "case",
    ["has", metric],
    [
      "step",
      ["to-number", ["get", metric]],
      mapPalette[0],
      b0,
      mapPalette[1],
      b1,
      mapPalette[2],
      b2,
      mapPalette[3],
    ],
    mapNoDataColor,
  ] as const;
}

export function getLegendRanges(metric: MetricKey) {
  const breaks = getMapBreaks(metric);
  return mapPalette.map((color, index) => {
    if (index === 0) {
      return { color, label: `Kurang dari ${breaks[0].toLocaleString("id-ID")}` };
    }
    if (index === mapPalette.length - 1) {
      return {
        color,
        label: `${breaks[index - 1].toLocaleString("id-ID")} atau lebih`,
      };
    }
    return {
      color,
      label: `${breaks[index - 1].toLocaleString("id-ID")} – ${breaks[index].toLocaleString("id-ID")}`,
    };
  });
}
