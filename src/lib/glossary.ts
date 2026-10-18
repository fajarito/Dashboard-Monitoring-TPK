export type GlossaryEntry = {
  id: string;
  term: string;
  short: string;
  definition: string;
  /** Alias yang bisa dipakai untuk matching label singkat. */
  aliases?: string[];
};

/** Glosarium hidup — selaras halaman Keterangan Istilah. */
export const glossaryEntries: GlossaryEntry[] = [
  {
    id: "tpk",
    term: "TPK",
    short: "Tim Pendamping Keluarga",
    definition:
      "Tim di tingkat desa/kelurahan yang mendampingi keluarga sasaran. Biasanya terdiri dari tenaga kesehatan, kader PKK, dan kader KB/PPKBD.",
    aliases: ["Tim Pendamping Keluarga", "Jumlah TPK"],
  },
  {
    id: "pkb",
    term: "PKB / PLKB",
    short: "Koordinator lapangan",
    definition:
      "Penyuluh KB (PKB/PLKB) yang membina dan mengawasi TPK di wilayah kerjanya. Satu PKB biasanya membina beberapa desa/kelurahan.",
    aliases: ["PKB", "PLKB", "Koordinator PKB"],
  },
  {
    id: "krs",
    term: "KRS",
    short: "Keluarga Berisiko Stunting",
    definition:
      "Keluarga yang memiliki faktor risiko stunting — misalnya ada baduta/balita, ibu hamil, atau kondisi lingkungan yang belum memadai.",
    aliases: ["Keluarga Berisiko Stunting", "Keluarga berisiko stunting"],
  },
  {
    id: "keluarga-sasaran",
    term: "Keluarga Sasaran",
    short: "Keluarga yang didampingi TPK",
    definition:
      "Keluarga yang menjadi fokus pendampingan TPK, biasanya karena ada anggota yang masuk kategori sasaran (ibu hamil, baduta, balita, PUS, atau berisiko stunting).",
    aliases: ["Kel. Sasaran", "Keluarga sasaran"],
  },
  {
    id: "baduta",
    term: "Baduta",
    short: "Bayi di bawah dua tahun",
    definition:
      "Anak berusia di bawah 2 tahun (0–23 bulan). Periode ini krusial untuk tumbuh kembang dan pencegahan stunting.",
  },
  {
    id: "balita",
    term: "Balita",
    short: "Anak di bawah lima tahun",
    definition:
      "Anak berusia di bawah 5 tahun. Pemantauan gizi dan kesehatan balita menjadi bagian dari pendampingan keluarga.",
  },
  {
    id: "pus",
    term: "PUS",
    short: "Pasangan Usia Subur",
    definition:
      "Pasangan suami-istri yang masih dalam usia subur dan berpotensi memiliki anak. Termasuk sasaran layanan KB dan pendampingan keluarga.",
    aliases: ["Pasangan Usia Subur"],
  },
  {
    id: "ibu-hamil",
    term: "Ibu Hamil",
    short: "Kehamilan dalam keluarga sasaran",
    definition:
      "Ibu yang sedang hamil di keluarga sasaran. Dipantau agar mendapat layanan kesehatan dan dukungan selama kehamilan.",
    aliases: ["Ibu hamil"],
  },
  {
    id: "jamban-tl",
    term: "Jamban Tidak Layak",
    short: "Jamban TL",
    definition:
      "Fasilitas buang air besar yang belum memenuhi standar kelayakan (misalnya tidak memiliki septic tank yang aman atau masih terbuka).",
    aliases: ["Jamban TL", "Jamban tidak layak"],
  },
  {
    id: "air-tl",
    term: "Sumber Air Tidak Layak",
    short: "Air TL",
    definition:
      "Sumber air minum/rumah tangga yang belum memenuhi standar kelayakan — berisiko bagi kesehatan keluarga, terutama anak.",
    aliases: ["Air TL", "Sumber Air Tidak Layak", "Sumber air tidak layak"],
  },
  {
    id: "rtlh",
    term: "RTLH",
    short: "Rumah Tidak Layak Huni",
    definition:
      "Rumah yang kondisi fisiknya belum memenuhi standar layak huni (misalnya lantai, dinding, atap, atau ventilasi yang buruk).",
    aliases: ["Rumah Tidak Layak Huni", "Rumah Tidak Layak Huni (RTLH)"],
  },
  {
    id: "prioritas",
    term: "Prioritas 1–4",
    short: "Tingkat prioritas pendampingan",
    definition:
      "Pengelompokan keluarga sasaran menurut tingkat urgensi pendampingan. Prioritas 1 paling mendesak; “bukan prioritas” berarti belum masuk kategori utama.",
    aliases: ["Prioritas 1", "Prioritas 2", "Komposisi prioritas"],
  },
];

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return glossaryEntries.find((entry) => entry.id === id);
}

export function findGlossaryByLabel(label: string): GlossaryEntry | undefined {
  const normalized = label.trim().toLowerCase();
  return glossaryEntries.find((entry) => {
    if (entry.term.toLowerCase() === normalized) return true;
    if (entry.short.toLowerCase() === normalized) return true;
    return entry.aliases?.some((alias) => alias.toLowerCase() === normalized);
  });
}
