/**
 * Label kode stunting_head (verval) — kamus sementara dari pola SIGA/PKH.
 * Belum ada lookup table resmi di dump; UI tetap tampilkan kode bila label kosong.
 */

const ATAP: Record<number, string> = {
  1: "Beton / genteng beton",
  2: "Genteng",
  3: "Seng / asbes",
  4: "Kayu / sirap",
  5: "Bambu / ijuk / rumbia",
  6: "Lainnya",
};

const DINDING: Record<number, string> = {
  1: "Tembok",
  2: "Kayu / papan",
  3: "Bambu",
  4: "Lainnya",
};

const LANTAI: Record<number, string> = {
  1: "Marmer / keramik",
  2: "Ubin / tegel / teraso",
  3: "Semen / bata merah",
  4: "Kayu / papan",
  5: "Bambu",
  6: "Tanah",
  7: "Lainnya",
};

const KONDISI: Record<number, string> = {
  1: "Baik / layak",
  2: "Rusak sedang",
  3: "Rusak berat",
};

const SUMBER_AIR: Record<number, string> = {
  1: "Air kemasan / isi ulang",
  2: "Ledeng / PDAM",
  3: "Sumur bor / pompa",
  4: "Sumur terlindung",
  5: "Sumur tak terlindung",
  6: "Mata air terlindung",
  7: "Mata air tak terlindung",
  8: "Air permukaan",
  9: "Air hujan",
  10: "Lainnya",
};

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

export function labelYaTidak(code: number | null | undefined) {
  return labelFrom(YA_TIDAK, code);
}
