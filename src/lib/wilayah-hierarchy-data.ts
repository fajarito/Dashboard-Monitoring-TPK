import {
  getKabupatenApiId,
  getKabupatenSlugByApiId,
} from "@/lib/kabupaten-api-id";
import {
  getKecamatanApiId,
  getKecamatanSlugByApiId,
} from "@/lib/kecamatan-api-id";
import { provinces, type Province } from "@/lib/map-data";
import {
  getProvinceSasaran,
  sasaranKeys,
  type SasaranCounts,
} from "@/lib/sasaran-indikator";

export type WilayahChildRow = {
  id: string;
  name: string;
  /** Label singkat di bawah nama (mis. "Kabupaten/Kota"). */
  kindLabel: string;
  keluargaSasaran: number;
  krs: number;
  sasaran: SasaranCounts;
  tpkCount: number;
};

export type KabupatenUnit = WilayahChildRow & {
  provinceId: string;
  kecamatan: WilayahChildRow[];
};

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSasaran(rand: () => number, krs: number): SasaranCounts {
  return {
    ibuHamil: Math.max(40, Math.round(krs * (0.28 + rand() * 0.12))),
    baduta: Math.max(30, Math.round(krs * (0.22 + rand() * 0.1))),
    balita: Math.max(80, Math.round(krs * (0.55 + rand() * 0.2))),
    jambanTidakLayak: Math.max(20, Math.round(krs * (0.3 + rand() * 0.15))),
    sumberAirTidakLayak: Math.max(15, Math.round(krs * (0.2 + rand() * 0.12))),
    rtlh: Math.max(18, Math.round(krs * (0.25 + rand() * 0.14))),
  };
}

function makeRow(
  id: string,
  name: string,
  kindLabel: string,
  rand: () => number,
  scale: number,
): WilayahChildRow {
  const krs = Math.max(120, Math.round(scale * (0.75 + rand() * 0.5)));
  const keluargaSasaran = Math.round(krs * (1.35 + rand() * 0.35));
  const tpkCount = Math.max(2, Math.round(keluargaSasaran / (18 + rand() * 10)));
  return {
    id,
    name,
    kindLabel,
    keluargaSasaran,
    krs,
    sasaran: makeSasaran(rand, krs),
    tpkCount,
  };
}

/** Kecamatan realistis Kota Depok (simulasi). */
const DEPOK_KECAMATAN = [
  "Beji",
  "Bojongsari",
  "Cilodong",
  "Cimanggis",
  "Cinere",
  "Cipayung",
  "Limo",
  "Pancoran Mas",
  "Sawangan",
  "Sukmajaya",
  "Tapos",
] as const;

/** Kabupaten/Kota inti Jawa Barat untuk demo drill-down. */
const JABAR_KAB: { id: string; name: string; share: number; kec?: string[] }[] =
  [
    {
      id: "kota-depok",
      name: "Kota Depok",
      share: 0.09,
      kec: [...DEPOK_KECAMATAN],
    },
    { id: "kota-bandung", name: "Kota Bandung", share: 0.12 },
    { id: "kab-bandung", name: "Kabupaten Bandung", share: 0.14 },
    { id: "kab-bogor", name: "Kabupaten Bogor", share: 0.16 },
    { id: "kota-bogor", name: "Kota Bogor", share: 0.07 },
    { id: "kota-bekasi", name: "Kota Bekasi", share: 0.11 },
    { id: "kab-bekasi", name: "Kabupaten Bekasi", share: 0.13 },
    { id: "kab-karawang", name: "Kabupaten Karawang", share: 0.1 },
    { id: "kota-cirebon", name: "Kota Cirebon", share: 0.04 },
    { id: "kab-garut", name: "Kabupaten Garut", share: 0.04 },
  ];

const GENERIC_KEC_NAMES = [
  "Sukamaju",
  "Cipayung",
  "Coblong",
  "Menteng",
  "Cibinong",
  "Citeureup",
  "Parung",
  "Cisarua",
  "Rancaekek",
  "Banjaran",
  "Soreang",
  "Dayeuhkolot",
];

function buildKecamatan(
  provinceId: string,
  kabId: string,
  kabName: string,
  names: string[],
  kabKrs: number,
): WilayahChildRow[] {
  const rand = mulberry32(hashSeed(`${provinceId}-${kabId}-kec`));
  const weights = names.map(() => 0.6 + rand());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return names.map((name, index) => {
    const id =
      kabId === "kota-depok"
        ? `kec-${name.toLowerCase().replace(/\s+/g, "")}-depok`
        : `kec-${kabId}-${String(index + 1).padStart(2, "0")}`;
    // Align known Depok search ids
    const slug = name.toLowerCase().replace(/\s+/g, "");
    const resolvedId =
      kabId === "kota-depok" ? `kec-${slug}-depok` : id;
    const share = weights[index]! / weightSum;
    const row = makeRow(
      resolvedId,
      name,
      "Kecamatan",
      rand,
      kabKrs * share,
    );
    void kabName;
    return row;
  });
}

function buildJabarKabupaten(province: Province): KabupatenUnit[] {
  const provinceSasaran = getProvinceSasaran(province);
  const totalKrs = province.krs;
  const shareSum = JABAR_KAB.reduce((s, k) => s + k.share, 0);

  return JABAR_KAB.map((kab) => {
    const rand = mulberry32(hashSeed(`jabar-${kab.id}`));
    const krs = Math.round((totalKrs * kab.share) / shareSum);
    const keluargaSasaran = Math.round(krs * (1.4 + rand() * 0.25));
    const tpkCount = Math.max(
      8,
      Math.round((province.tpk * kab.share) / shareSum),
    );
    // Scale sasaran roughly to kab share of province
    const sasaran = Object.fromEntries(
      sasaranKeys.map((key) => [
        key,
        Math.max(
          20,
          Math.round((provinceSasaran[key] * kab.share) / shareSum),
        ),
      ]),
    ) as SasaranCounts;

    const uniqueKec =
      kab.kec ??
      Array.from({ length: 5 + Math.floor(rand() * 3) }, (_, i) => {
        return GENERIC_KEC_NAMES[
          (i + hashSeed(kab.id)) % GENERIC_KEC_NAMES.length
        ]!;
      }).filter((name, i, arr) => arr.indexOf(name) === i);

    const kecamatan = buildKecamatan(
      "jabar",
      kab.id,
      kab.name,
      uniqueKec,
      krs,
    );

    return {
      id: kab.id,
      name: kab.name,
      kindLabel: kab.name.startsWith("Kota") ? "Kota" : "Kabupaten",
      provinceId: "jabar",
      keluargaSasaran,
      krs,
      sasaran,
      tpkCount,
      kecamatan,
    };
  });
}

function buildGenericKabupaten(province: Province): KabupatenUnit[] {
  const rand = mulberry32(hashSeed(`${province.id}-kab-list`));
  const count = 5 + Math.floor(rand() * 3);
  const capital = province.capital;
  const names = [
    `Kota ${capital}`,
    `Kabupaten ${capital}`,
    `Kabupaten Utara`,
    `Kabupaten Selatan`,
    `Kabupaten Timur`,
    `Kabupaten Barat`,
    `Kota Satelit`,
    `Kabupaten Tengah`,
  ].slice(0, count);

  const shares = names.map(() => 0.7 + rand());
  const shareSum = shares.reduce((a, b) => a + b, 0);
  const provinceSasaran = getProvinceSasaran(province);

  return names.map((name, index) => {
    const id = `${province.id}-kab-${String(index + 1).padStart(2, "0")}`;
    const share = shares[index]! / shareSum;
    const krs = Math.round(province.krs * share);
    const keluargaSasaran = Math.round(krs * (1.35 + rand() * 0.3));
    const tpkCount = Math.max(4, Math.round(province.tpk * share));
    const sasaran = Object.fromEntries(
      sasaranKeys.map((key) => [
        key,
        Math.max(15, Math.round(provinceSasaran[key] * share)),
      ]),
    ) as SasaranCounts;
    const kecCount = 4 + Math.floor(rand() * 3);
    const kecNames = Array.from({ length: kecCount }, (_, i) => {
      const base =
        GENERIC_KEC_NAMES[(i + index * 3) % GENERIC_KEC_NAMES.length]!;
      return `${base}`;
    });
    // dedupe
    const unique = [...new Set(kecNames)];
    while (unique.length < kecCount) {
      unique.push(`Wilayah ${unique.length + 1}`);
    }

    return {
      id,
      name,
      kindLabel: name.startsWith("Kota") ? "Kota" : "Kabupaten",
      provinceId: province.id,
      keluargaSasaran,
      krs,
      sasaran,
      tpkCount,
      kecamatan: buildKecamatan(province.id, id, name, unique, krs),
    };
  });
}

const cache = new Map<string, KabupatenUnit[]>();

export function getKabupatenByProvince(provinceId: string): KabupatenUnit[] {
  if (cache.has(provinceId)) return cache.get(provinceId)!;
  const province = provinces.find((p) => p.id === provinceId);
  if (!province) return [];
  const list =
    provinceId === "jabar"
      ? buildJabarKabupaten(province)
      : buildGenericKabupaten(province);
  cache.set(provinceId, list);
  return list;
}

export function getKabupatenById(provinceId: string, kabId: string) {
  const list = getKabupatenByProvince(provinceId);
  const bySlug = list.find((item) => item.id === kabId);
  if (bySlug) return bySlug;

  const mappedSlug = getKabupatenSlugByApiId(kabId);
  if (mappedSlug) {
    const byMapped = list.find((item) => item.id === mappedSlug);
    if (byMapped) return byMapped;
  }

  // Stub untuk id_kabupaten live tanpa hierarki mock (kecamatan tetap kosong).
  // Nama asli di-resolve async via resolveKabupatenDisplayName (v_kabupaten / peringkat).
  const apiId = getKabupatenApiId(kabId);
  if (!apiId) return null;
  return {
    id: kabId,
    name: `Kabupaten/Kota (ID ${apiId})`,
    kindLabel: "Kabupaten/Kota",
    provinceId,
    keluargaSasaran: 0,
    krs: 0,
    sasaran: {
      ibuHamil: 0,
      baduta: 0,
      balita: 0,
      jambanTidakLayak: 0,
      sumberAirTidakLayak: 0,
      rtlh: 0,
    },
    tpkCount: 0,
    kecamatan: [],
  } satisfies KabupatenUnit;
}

export function getKecamatanById(
  provinceId: string,
  kabId: string,
  kecId: string,
) {
  const kab = getKabupatenById(provinceId, kabId);
  if (!kab) return null;

  const bySlug = kab.kecamatan.find((item) => item.id === kecId);
  if (bySlug) return bySlug;

  const mappedSlug = getKecamatanSlugByApiId(kecId);
  if (mappedSlug) {
    const byMapped = kab.kecamatan.find((item) => item.id === mappedSlug);
    if (byMapped) return byMapped;
  }

  // Stub untuk id_kecamatan live tanpa hierarki mock.
  // Nama asli di-resolve async via resolveKecamatanDisplayName (v_kecamatan / peringkat).
  const apiId = getKecamatanApiId(kecId);
  if (!apiId) return null;
  return {
    id: kecId,
    name: `Kecamatan (ID ${apiId})`,
    kindLabel: "Kecamatan",
    keluargaSasaran: 0,
    krs: 0,
    sasaran: {
      ibuHamil: 0,
      baduta: 0,
      balita: 0,
      jambanTidakLayak: 0,
      sumberAirTidakLayak: 0,
      rtlh: 0,
    },
    tpkCount: 0,
  };
}

export function summarizeChildRows(rows: WilayahChildRow[]) {
  const sasaran = rows.reduce(
    (acc, row) => {
      for (const key of sasaranKeys) acc[key] += row.sasaran[key];
      return acc;
    },
    {
      ibuHamil: 0,
      baduta: 0,
      balita: 0,
      jambanTidakLayak: 0,
      sumberAirTidakLayak: 0,
      rtlh: 0,
    } satisfies SasaranCounts,
  );
  return {
    keluargaSasaran: rows.reduce((s, r) => s + r.keluargaSasaran, 0),
    krs: rows.reduce((s, r) => s + r.krs, 0),
    tpkCount: rows.reduce((s, r) => s + r.tpkCount, 0),
    sasaran,
  };
}
