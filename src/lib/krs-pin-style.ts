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
