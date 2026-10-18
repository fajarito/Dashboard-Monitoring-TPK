import { formatNumber, nationalTotals } from "@/lib/map-data";

/** Pilar / kategori anggota TPK (simulasi nasional, selaras total anggota). */
export type KomposisiPillar = {
  id: "nakes" | "pkk" | "kb" | "lainnya";
  label: string;
  shortLabel: string;
  description: string;
  value: number;
  color: string;
  trackClass: string;
};

const totalAnggota = nationalTotals.anggota;

/**
 * Proporsi simulasi: tiga peran utama + sisa “Lainnya”
 * (~6% mendekati selisih live StatusTPK di luar 1/2/3).
 * Jumlah = total anggota.
 */
const shares = {
  nakes: 0.325,
  pkk: 0.318,
  kb: 0.297,
  lainnya: 0.06,
} as const;

function splitTotal(total: number) {
  const nakes = Math.round(total * shares.nakes);
  const pkk = Math.round(total * shares.pkk);
  const kb = Math.round(total * shares.kb);
  const lainnya = Math.max(0, total - nakes - pkk - kb);
  return { nakes, pkk, kb, lainnya };
}

const counts = splitTotal(totalAnggota);

export const komposisiPilar: KomposisiPillar[] = [
  {
    id: "nakes",
    label: "Tenaga Kesehatan",
    shortLabel: "Nakes",
    description: "Bidan, perawat, dan tenaga kesehatan di TPK.",
    value: counts.nakes,
    color: "#155eef",
    trackClass: "bg-[#155eef]",
  },
  {
    id: "pkk",
    label: "Kader PKK",
    shortLabel: "PKK",
    description: "Pengurus dan kader PKK yang mendampingi keluarga.",
    value: counts.pkk,
    color: "#10b8cf",
    trackClass: "bg-[#10b8cf]",
  },
  {
    id: "kb",
    label: "Kader KB/PPKBD",
    shortLabel: "KB/PPKBD",
    description: "Kader KB dan PPKBD di tingkat desa/kelurahan.",
    value: counts.kb,
    color: "#7c8cf8",
    trackClass: "bg-[#7c8cf8]",
  },
  {
    id: "lainnya",
    label: "Lainnya",
    shortLabel: "Lainnya",
    description:
      "Anggota TPK dengan StatusTPK di luar Bidan/PKK/Kader KB (termasuk kosong).",
    value: counts.lainnya,
    color: "#94a3b8",
    trackClass: "bg-[#94a3b8]",
  },
];

export function getKomposisiPercent(value: number, total = totalAnggota) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function formatKomposisiPercent(value: number, total = totalAnggota) {
  return `${getKomposisiPercent(value, total).toLocaleString("id-ID", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })}%`;
}

export function buildConicGradient(
  items: KomposisiPillar[] = komposisiPilar,
  total = totalAnggota,
) {
  let cursor = 0;
  const stops: string[] = [];
  for (const item of items) {
    const start = cursor;
    const end = cursor + getKomposisiPercent(item.value, total);
    stops.push(`${item.color} ${start}% ${end}%`);
    cursor = end;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

export const komposisiTotalAnggota = totalAnggota;
export const komposisiTotalLabel = formatNumber(totalAnggota);
