import type { Province } from "@/lib/map-data";

/** Pusat zoom kasar untuk fokus peta nasional (simulasi). */
const centers: Record<string, { center: [number, number]; zoom: number }> = {
  aceh: { center: [96.7, 4.2], zoom: 6.2 },
  sumut: { center: [99.1, 2.1], zoom: 5.8 },
  sumbar: { center: [100.5, -0.9], zoom: 6.2 },
  riau: { center: [101.7, 0.5], zoom: 6 },
  jambi: { center: [102.7, -1.6], zoom: 6.2 },
  sumsel: { center: [104.1, -3.2], zoom: 6 },
  bengkulu: { center: [102.3, -3.8], zoom: 6.4 },
  lampung: { center: [105.4, -5], zoom: 6.3 },
  babel: { center: [106.1, -2.7], zoom: 6.6 },
  kepri: { center: [104.5, 1], zoom: 6.4 },
  dki: { center: [106.85, -6.2], zoom: 8.2 },
  jabar: { center: [107.6, -6.9], zoom: 6.6 },
  jateng: { center: [110.1, -7.2], zoom: 6.5 },
  diy: { center: [110.4, -7.8], zoom: 8 },
  jatim: { center: [112.6, -7.7], zoom: 6.3 },
  banten: { center: [106.1, -6.4], zoom: 7.2 },
  bali: { center: [115.1, -8.4], zoom: 7.4 },
  ntb: { center: [117.4, -8.6], zoom: 6.6 },
  ntt: { center: [121.8, -9.2], zoom: 6.2 },
  kalbar: { center: [110.3, -0.1], zoom: 5.8 },
  kalteng: { center: [113.4, -1.7], zoom: 5.6 },
  kalsel: { center: [115.3, -3], zoom: 6.2 },
  kaltim: { center: [116.5, 0.5], zoom: 5.6 },
  kalut: { center: [116.3, 3.1], zoom: 6 },
  sulut: { center: [124.7, 1.3], zoom: 6.4 },
  sulteng: { center: [120.5, -1.3], zoom: 5.8 },
  sulsel: { center: [120.2, -4.2], zoom: 6 },
  sultra: { center: [122.1, -4], zoom: 6 },
  gorontalo: { center: [122.4, 0.7], zoom: 7 },
  sulbar: { center: [119.3, -2.7], zoom: 6.6 },
  maluku: { center: [129.5, -3.2], zoom: 5.8 },
  malut: { center: [127.8, 1.5], zoom: 6 },
  papua: { center: [138.5, -4.5], zoom: 5 },
  papbar: { center: [133.5, -2], zoom: 5.4 },
};

export function getProvinceFocus(province: Province) {
  return (
    centers[province.id] ?? {
      center: [118, -2] as [number, number],
      zoom: 4.2,
    }
  );
}
