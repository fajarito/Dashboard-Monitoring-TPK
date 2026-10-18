import {
  getMapBreaks,
  type MetricKey,
} from "@/lib/map-data";
import { mapNoDataColor, mapPalette } from "@/lib/navigation";

export function getMapFillExpression(metric: MetricKey) {
  const breaks = getMapBreaks(metric);
  return [
    "case",
    ["has", metric],
    [
      "step",
      ["to-number", ["get", metric]],
      mapPalette[0],
      breaks[0],
      mapPalette[1],
      breaks[1],
      mapPalette[2],
      breaks[2],
      mapPalette[3],
      breaks[3],
      mapPalette[4],
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
