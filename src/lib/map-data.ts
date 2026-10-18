/** Data simulasi wilayah untuk demo peta (bukan data resmi). */
export type MetricKey = "tpk" | "anggota" | "pkb" | "krs";

export type Province = {
  id: string;
  adminCode: number;
  name: string;
  capital: string;
  tpk: number;
  anggota: number;
  pkb: number;
  krs: number;
  baduta: number;
  balita: number;
  pus: number;
  ibuHamil: number;
};

export const metricLabels: Record<MetricKey, string> = {
  tpk: "Jumlah TPK",
  anggota: "Jumlah Anggota TPK",
  pkb: "Jumlah PKB",
  krs: "Jumlah Keluarga Berisiko Stunting (KRS)",
};

export const metricHelp: Record<MetricKey, string> = {
  tpk: "Tim Pendamping Keluarga di wilayah.",
  anggota: "Total anggota TPK (misalnya Bidan/Perawat, PKK, Kader KB).",
  pkb: "Koordinator / petugas PKB–PLKB pembina wilayah.",
  krs: "Keluarga unik yang berisiko stunting di wilayah.",
};

export const metricOptions: MetricKey[] = ["tpk", "anggota", "pkb", "krs"];

export const provinces: Province[] = [
  {
    "id": "aceh",
    "adminCode": 11,
    "name": "Aceh",
    "capital": "Banda Aceh",
    "tpk": 5426,
    "anggota": 16278,
    "pkb": 1029,
    "krs": 342760,
    "baduta": 89420,
    "balita": 214520,
    "pus": 838200,
    "ibuHamil": 91430
  },
  {
    "id": "sumut",
    "adminCode": 12,
    "name": "Sumatera Utara",
    "capital": "Medan",
    "tpk": 7964,
    "anggota": 23892,
    "pkb": 1184,
    "krs": 692170,
    "baduta": 154600,
    "balita": 421300,
    "pus": 1813100,
    "ibuHamil": 162500
  },
  {
    "id": "sumbar",
    "adminCode": 13,
    "name": "Sumatera Barat",
    "capital": "Padang",
    "tpk": 5108,
    "anggota": 15324,
    "pkb": 832,
    "krs": 381420,
    "baduta": 94300,
    "balita": 244200,
    "pus": 912800,
    "ibuHamil": 98100
  },
  {
    "id": "riau",
    "adminCode": 14,
    "name": "Riau",
    "capital": "Pekanbaru",
    "tpk": 4584,
    "anggota": 13752,
    "pkb": 711,
    "krs": 389860,
    "baduta": 87500,
    "balita": 234600,
    "pus": 1003700,
    "ibuHamil": 93900
  },
  {
    "id": "jambi",
    "adminCode": 15,
    "name": "Jambi",
    "capital": "Jambi",
    "tpk": 3120,
    "anggota": 9360,
    "pkb": 482,
    "krs": 248500,
    "baduta": 61200,
    "balita": 168400,
    "pus": 612300,
    "ibuHamil": 64200
  },
  {
    "id": "sumsel",
    "adminCode": 16,
    "name": "Sumatera Selatan",
    "capital": "Palembang",
    "tpk": 6172,
    "anggota": 18516,
    "pkb": 904,
    "krs": 523190,
    "baduta": 110800,
    "balita": 301200,
    "pus": 1329500,
    "ibuHamil": 118300
  },
  {
    "id": "bengkulu",
    "adminCode": 17,
    "name": "Bengkulu",
    "capital": "Bengkulu",
    "tpk": 2184,
    "anggota": 6552,
    "pkb": 318,
    "krs": 168420,
    "baduta": 41200,
    "balita": 112300,
    "pus": 398200,
    "ibuHamil": 43100
  },
  {
    "id": "lampung",
    "adminCode": 18,
    "name": "Lampung",
    "capital": "Bandar Lampung",
    "tpk": 5981,
    "anggota": 17943,
    "pkb": 828,
    "krs": 477230,
    "baduta": 102400,
    "balita": 278900,
    "pus": 1242300,
    "ibuHamil": 107200
  },
  {
    "id": "babel",
    "adminCode": 19,
    "name": "Kepulauan Bangka Belitung",
    "capital": "Pangkalpinang",
    "tpk": 1680,
    "anggota": 5040,
    "pkb": 246,
    "krs": 112340,
    "baduta": 28400,
    "balita": 76400,
    "pus": 286500,
    "ibuHamil": 29800
  },
  {
    "id": "kepri",
    "adminCode": 21,
    "name": "Kepulauan Riau",
    "capital": "Tanjungpinang",
    "tpk": 1924,
    "anggota": 5772,
    "pkb": 288,
    "krs": 142680,
    "baduta": 35600,
    "balita": 98400,
    "pus": 342100,
    "ibuHamil": 37200
  },
  {
    "id": "dki",
    "adminCode": 31,
    "name": "DKI Jakarta",
    "capital": "Jakarta",
    "tpk": 8650,
    "anggota": 25950,
    "pkb": 1420,
    "krs": 986420,
    "baduta": 248600,
    "balita": 682400,
    "pus": 3012500,
    "ibuHamil": 268400
  },
  {
    "id": "jabar",
    "adminCode": 32,
    "name": "Jawa Barat",
    "capital": "Bandung",
    "tpk": 21436,
    "anggota": 64308,
    "pkb": 2486,
    "krs": 2184730,
    "baduta": 612480,
    "balita": 1842600,
    "pus": 7902400,
    "ibuHamil": 798200
  },
  {
    "id": "jateng",
    "adminCode": 33,
    "name": "Jawa Tengah",
    "capital": "Semarang",
    "tpk": 18294,
    "anggota": 54882,
    "pkb": 2108,
    "krs": 1674280,
    "baduta": 434500,
    "balita": 1281400,
    "pus": 5884200,
    "ibuHamil": 594100
  },
  {
    "id": "diy",
    "adminCode": 34,
    "name": "DI Yogyakarta",
    "capital": "Yogyakarta",
    "tpk": 2468,
    "anggota": 7404,
    "pkb": 412,
    "krs": 186520,
    "baduta": 46800,
    "balita": 128600,
    "pus": 612400,
    "ibuHamil": 49800
  },
  {
    "id": "jatim",
    "adminCode": 35,
    "name": "Jawa Timur",
    "capital": "Surabaya",
    "tpk": 19872,
    "anggota": 59616,
    "pkb": 2236,
    "krs": 1816420,
    "baduta": 472600,
    "balita": 1394200,
    "pus": 6113500,
    "ibuHamil": 621800
  },
  {
    "id": "banten",
    "adminCode": 36,
    "name": "Banten",
    "capital": "Serang",
    "tpk": 7420,
    "anggota": 22260,
    "pkb": 986,
    "krs": 812340,
    "baduta": 198400,
    "balita": 542800,
    "pus": 2412600,
    "ibuHamil": 208600
  },
  {
    "id": "bali",
    "adminCode": 51,
    "name": "Bali",
    "capital": "Denpasar",
    "tpk": 2806,
    "anggota": 8418,
    "pkb": 512,
    "krs": 202870,
    "baduta": 48500,
    "balita": 142200,
    "pus": 672400,
    "ibuHamil": 51900
  },
  {
    "id": "ntb",
    "adminCode": 52,
    "name": "Nusa Tenggara Barat",
    "capital": "Mataram",
    "tpk": 3684,
    "anggota": 11052,
    "pkb": 548,
    "krs": 312480,
    "baduta": 78400,
    "balita": 214600,
    "pus": 812300,
    "ibuHamil": 82400
  },
  {
    "id": "ntt",
    "adminCode": 53,
    "name": "Nusa Tenggara Timur",
    "capital": "Kupang",
    "tpk": 4126,
    "anggota": 12378,
    "pkb": 612,
    "krs": 368920,
    "baduta": 92400,
    "balita": 248300,
    "pus": 892400,
    "ibuHamil": 96800
  },
  {
    "id": "kalbar",
    "adminCode": 61,
    "name": "Kalimantan Barat",
    "capital": "Pontianak",
    "tpk": 4820,
    "anggota": 14460,
    "pkb": 698,
    "krs": 323480,
    "baduta": 76300,
    "balita": 221500,
    "pus": 894200,
    "ibuHamil": 82100
  },
  {
    "id": "kalteng",
    "adminCode": 62,
    "name": "Kalimantan Tengah",
    "capital": "Palangka Raya",
    "tpk": 2864,
    "anggota": 8592,
    "pkb": 428,
    "krs": 198640,
    "baduta": 48600,
    "balita": 136800,
    "pus": 498200,
    "ibuHamil": 51200
  },
  {
    "id": "kalsel",
    "adminCode": 63,
    "name": "Kalimantan Selatan",
    "capital": "Banjarbaru",
    "tpk": 3884,
    "anggota": 11652,
    "pkb": 614,
    "krs": 274630,
    "baduta": 67300,
    "balita": 192100,
    "pus": 717300,
    "ibuHamil": 70800
  },
  {
    "id": "kaltim",
    "adminCode": 64,
    "name": "Kalimantan Timur",
    "capital": "Samarinda",
    "tpk": 3726,
    "anggota": 11178,
    "pkb": 557,
    "krs": 226910,
    "baduta": 61900,
    "balita": 176800,
    "pus": 612700,
    "ibuHamil": 64200
  },
  {
    "id": "kalut",
    "adminCode": 65,
    "name": "Kalimantan Utara",
    "capital": "Tanjung Selor",
    "tpk": 1248,
    "anggota": 3744,
    "pkb": 186,
    "krs": 86420,
    "baduta": 21400,
    "balita": 58600,
    "pus": 198400,
    "ibuHamil": 22600
  },
  {
    "id": "sulut",
    "adminCode": 71,
    "name": "Sulawesi Utara",
    "capital": "Manado",
    "tpk": 2986,
    "anggota": 8958,
    "pkb": 448,
    "krs": 186420,
    "baduta": 46800,
    "balita": 128400,
    "pus": 512600,
    "ibuHamil": 49200
  },
  {
    "id": "sulteng",
    "adminCode": 72,
    "name": "Sulawesi Tengah",
    "capital": "Palu",
    "tpk": 3492,
    "anggota": 10476,
    "pkb": 522,
    "krs": 228410,
    "baduta": 57200,
    "balita": 165500,
    "pus": 523900,
    "ibuHamil": 60100
  },
  {
    "id": "sulsel",
    "adminCode": 73,
    "name": "Sulawesi Selatan",
    "capital": "Makassar",
    "tpk": 7414,
    "anggota": 22242,
    "pkb": 1092,
    "krs": 582340,
    "baduta": 138300,
    "balita": 391800,
    "pus": 1498600,
    "ibuHamil": 145900
  },
  {
    "id": "sultra",
    "adminCode": 74,
    "name": "Sulawesi Tenggara",
    "capital": "Kendari",
    "tpk": 2684,
    "anggota": 8052,
    "pkb": 398,
    "krs": 172480,
    "baduta": 42800,
    "balita": 118600,
    "pus": 412300,
    "ibuHamil": 45200
  },
  {
    "id": "gorontalo",
    "adminCode": 75,
    "name": "Gorontalo",
    "capital": "Gorontalo",
    "tpk": 1426,
    "anggota": 4278,
    "pkb": 216,
    "krs": 98420,
    "baduta": 24600,
    "balita": 68200,
    "pus": 228400,
    "ibuHamil": 25800
  },
  {
    "id": "sulbar",
    "adminCode": 76,
    "name": "Sulawesi Barat",
    "capital": "Mamuju",
    "tpk": 1584,
    "anggota": 4752,
    "pkb": 238,
    "krs": 108640,
    "baduta": 27200,
    "balita": 74600,
    "pus": 248600,
    "ibuHamil": 28600
  },
  {
    "id": "maluku",
    "adminCode": 81,
    "name": "Maluku",
    "capital": "Ambon",
    "tpk": 2118,
    "anggota": 6354,
    "pkb": 349,
    "krs": 128790,
    "baduta": 34600,
    "balita": 98700,
    "pus": 318400,
    "ibuHamil": 36200
  },
  {
    "id": "malut",
    "adminCode": 82,
    "name": "Maluku Utara",
    "capital": "Sofifi",
    "tpk": 1386,
    "anggota": 4158,
    "pkb": 208,
    "krs": 92480,
    "baduta": 23200,
    "balita": 64200,
    "pus": 198600,
    "ibuHamil": 24400
  },
  {
    "id": "papua",
    "adminCode": 91,
    "name": "Papua",
    "capital": "Jayapura",
    "tpk": 3982,
    "anggota": 11946,
    "pkb": 684,
    "krs": 267380,
    "baduta": 74200,
    "balita": 204700,
    "pus": 446800,
    "ibuHamil": 78500
  },
  {
    "id": "papbar",
    "adminCode": 92,
    "name": "Papua Barat",
    "capital": "Manokwari",
    "tpk": 1648,
    "anggota": 4944,
    "pkb": 278,
    "krs": 112640,
    "baduta": 28600,
    "balita": 78400,
    "pus": 198200,
    "ibuHamil": 30200
  }
];

export const nationalTotals = {
  tpk: provinces.reduce((sum, p) => sum + p.tpk, 0),
  anggota: provinces.reduce((sum, p) => sum + p.anggota, 0),
  pkb: provinces.reduce((sum, p) => sum + p.pkb, 0),
  krs: provinces.reduce((sum, p) => sum + p.krs, 0),
};

/**
 * Cakupan desa/kelurahan nasional (simulasi) — selaras skala agregat mock.
 * Dipakai untuk rasio PKB : desa/kelurahan.
 */
export const nationalDesaKelurahan = 83_420;

/** Ambang ideal: 1 PKB membina paling banyak 2 desa/kelurahan. */
export const PKB_DESA_IDEAL_MAX = 2;

/** Rasio beban: KRS ÷ TPK → “1 TPK : X KRS”. */
export function getKrsPerTpkRatio(
  tpk = nationalTotals.tpk,
  krs = nationalTotals.krs,
) {
  if (tpk <= 0) return 0;
  return krs / tpk;
}

/** Rasio beban: desa/kelurahan ÷ PKB → “1 PKB : X desa”. */
export function getDesaPerPkbRatio(
  pkb = nationalTotals.pkb,
  desa = nationalDesaKelurahan,
) {
  if (pkb <= 0) return 0;
  return desa / pkb;
}

/** Estimasi desa/kelurahan per provinsi — proporsional terhadap PKB nasional (simulasi). */
export function estimateDesaForProvince(province: Province) {
  if (nationalTotals.pkb <= 0) return 0;
  return Math.max(
    1,
    Math.round(nationalDesaKelurahan * (province.pkb / nationalTotals.pkb)),
  );
}

export function formatRatioValue(value: number, digits = 1) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(digits, 1),
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function getProvinceByAdminCode(code: number) {
  return provinces.find((province) => province.adminCode === code);
}

export function getMapBreaks(metric: MetricKey) {
  const values = provinces
    .map((region) => region[metric])
    .sort((first, second) => first - second);
  return [0.2, 0.4, 0.6, 0.8].map(
    (quantile) =>
      values[
        Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)
      ],
  );
}
