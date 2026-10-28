/**
 * Label kode stunting_head — kamus resmi form Verval (screenshot Q17–Q25).
 * Sumber: /cursor/stores/self/media/verval-form-labels/
 *   17-atap, 18-dinding, 19-lantai, 20-penerangan, 21-air, 22-bab, 25-bahan-bakar
 */

/** Q17 — Jenis atap rumah terluas */
const ATAP: Record<number, string> = {
  1: "Beton",
  2: "Genteng",
  3: "Seng",
  4: "Asbes",
  5: "Kayu/Sirap",
  6: "Bambu",
  7: "Jerami/Ijuk/Rumbia/Daun-daunan",
  8: "Lainnya",
};

/** Q18 — Jenis dinding rumah terluas */
const DINDING: Record<number, string> = {
  1: "Tembok",
  2: "Plesteran anyaman bambu/kawat",
  3: "Kayu/Papan/Gypsum",
  4: "Anyaman bambu",
  5: "Batang kayu",
  6: "Bambu",
  7: "Lainnya",
};

/** Q19 — Jenis lantai rumah terluas */
const LANTAI: Record<number, string> = {
  1: "Marmer/granit",
  2: "Keramik",
  3: "Parket/vinil/karpet",
  4: "Ubin/tegel/teraso",
  5: "Kayu/papan",
  6: "Semen/bata merah",
  7: "Bambu",
  8: "Tanah",
  9: "Lainnya",
};

/** Q17.2 / 18.2 / 19.2 — Kondisi atap / dinding / lantai */
const KONDISI: Record<number, string> = {
  1: "Baik",
  2: "Rusak Ringan",
  3: "Rusak Berat",
};

/** Q21 — Sumber air minum utama (12 opsi; kemasan bermerek ≠ isi ulang) */
const SUMBER_AIR: Record<number, string> = {
  1: "Air kemasan bermerek",
  2: "Air isi ulang",
  3: "Ledeng/pompa",
  4: "Sumur bor/pompa",
  5: "Sumur terlindung",
  6: "Sumur tak terlindung",
  7: "Mata air terlindung",
  8: "Mata air tak terlindung",
  9: "Air permukaan (sungai/danau/waduk/kolam/irigasi)",
  10: "Kran umum/hidran umum/terminal air",
  11: "Penampungan Air Hujan (PAH)",
  12: "Lainnya",
};

/**
 * Q22 — Apakah memiliki fasilitas tempat buang air besar?
 * Kolom `memiliki_tempat_bab` = kode 1–5 (teks panjang form).
 */
const FASILITAS_BAB: Record<number, string> = {
  1: "Ya, milik sendiri dengan leher angsa dan tangki septik/IPAL dan dilakukan penyedotan secara berkala (satu kali dalam 3 - 5 tahun)",
  2: "Ya, milik sendiri dengan leher angsa dan tangki septik/IPAL",
  3: "Ya, MCK komunal dengan leher angsa dan tangki septik/IPAL",
  4: "Ya, lainnya",
  5: "Tidak ada",
};

/** Q20 — Sumber penerangan utama */
const PENERANGAN: Record<number, string> = {
  1: "Listrik PLN meteran",
  2: "Listrik PLN non meteran",
  3: "Listrik non-PLN (accu (aki)/genset/solar cell/pembangkit listrik tenaga surya tidak dikelola PLN, dan lain-lain)",
  4: "Bukan listrik",
};

/** Q20.2 — Besar daya terpasang */
const DAYA_PENERANGAN: Record<number, string> = {
  1: "450 watt",
  2: "900 watt",
  3: "1.300 watt",
  4: "> 1.300 watt",
};

/** Q25 — Bahan bakar utama untuk memasak */
const BAHAN_BAKAR: Record<number, string> = {
  1: "Listrik",
  2: "Gas 12 kg",
  3: "Gas 5,5 kg/blue gaz",
  4: "Gas 3 kg",
  5: "Minyak tanah",
  6: "Briket/arang/kayu",
  7: "Lainnya",
};

/** Legacy Ya/Tidak — jangan pakai untuk Q22 BAB. */
const YA_TIDAK: Record<number, string> = {
  1: "Ya",
  2: "Tidak",
};

function labelFrom(
  map: Record<number, string>,
  code: number | null | undefined,
): string | null {
  if (code == null || !Number.isFinite(code)) return null;
  return map[code] ?? `Kode ${code}`;
}

export function labelJenisAtap(code: number | null | undefined) {
  return labelFrom(ATAP, code);
}

export function labelJenisDinding(code: number | null | undefined) {
  return labelFrom(DINDING, code);
}

export function labelJenisLantai(code: number | null | undefined) {
  return labelFrom(LANTAI, code);
}

export function labelKondisiBangunan(code: number | null | undefined) {
  return labelFrom(KONDISI, code);
}

export function labelSumberAirMinum(code: number | null | undefined) {
  return labelFrom(SUMBER_AIR, code);
}

/** Q22 — `memiliki_tempat_bab` (bukan Ya/Tidak sederhana). */
export function labelFasilitasBab(code: number | null | undefined) {
  return labelFrom(FASILITAS_BAB, code);
}

export function labelSumberPenerangan(code: number | null | undefined) {
  return labelFrom(PENERANGAN, code);
}

export function labelDayaPenerangan(code: number | null | undefined) {
  return labelFrom(DAYA_PENERANGAN, code);
}

export function labelBahanBakarMasak(code: number | null | undefined) {
  return labelFrom(BAHAN_BAKAR, code);
}

export function labelYaTidak(code: number | null | undefined) {
  return labelFrom(YA_TIDAK, code);
}
