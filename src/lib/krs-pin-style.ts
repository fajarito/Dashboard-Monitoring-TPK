import { INDICATOR_COLORS } from "@/lib/map-indicator";
import type { TpkKeluargaPrioritas } from "@/lib/data/types";

/** Warna pin menurut prioritas KRS (spek palet indikator). */
export const KRS_PIN_COLORS: Record<TpkKeluargaPrioritas, string> = {
  p1: INDICATOR_COLORS.sangatBerat,
  p2: INDICATOR_COLORS.berat,
  p3: INDICATOR_COLORS.waspada,
  p4: INDICATOR_COLORS.ideal,
  bukan: INDICATOR_COLORS.sangatBaik,
  tidakRisiko: INDICATOR_COLORS.noData,
};

export const KRS_PIN_LABELS: Record<TpkKeluargaPrioritas, string> = {
  p1: "Prioritas 1",
  p2: "Prioritas 2",
  p3: "Prioritas 3",
  p4: "Prioritas 4",
  bukan: "Bukan prioritas",
  tidakRisiko: "Tidak berisiko",
};

/**
 * Warna cluster dari fillColor anak (mayoritas).
 * Tanpa ini, MarkerCluster.Default.css mengecat small-cluster hijau —
 * filter Prioritas 3 terlihat "hijau" padahal pin individu kuning.
 */
export function majorityPinColor(
  colors: Array<string | null | undefined>,
  fallback: string = KRS_PIN_COLORS.bukan,
): string {
  const counts = new Map<string, number>();
  for (const raw of colors) {
    const color = (raw && String(raw).trim()) || fallback;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best = fallback;
  let bestN = -1;
  for (const [color, n] of counts) {
    if (n > bestN) {
      best = color;
      bestN = n;
    }
  }
  return best;
}

/** Kontras teks di atas fill prioritas (kuning/oranye → gelap). */
export function pinLabelInk(bg: string): string {
  const hex = bg.replace("#", "").trim();
  if (hex.length < 6) return "#0f172a";
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return "#0f172a";
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#0f172a" : "#ffffff";
}

/**
 * Ray-cast point-in-polygon (lng/lat ring).
 * Ring = [[lng, lat], ...] — ring tertutup opsional.
 */
export function pointInPolygon(
  lng: number,
  lat: number,
  ring: Array<[number, number]>,
): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0];
    const yi = ring[i]![1];
    const xj = ring[j]![0];
    const yj = ring[j]![1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
