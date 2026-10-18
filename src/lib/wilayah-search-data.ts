import { provinces } from "@/lib/map-data";

export type WilayahLevel =
  | "provinsi"
  | "kabupaten_kota"
  | "kecamatan"
  | "desa";

export const wilayahLevelLabels: Record<WilayahLevel, string> = {
  provinsi: "Provinsi",
  kabupaten_kota: "Kabupaten/Kota",
  kecamatan: "Kecamatan",
  desa: "Desa/Kelurahan",
};

export type WilayahSearchItem = {
  id: string;
  name: string;
  level: WilayahLevel;
  /** Keterangan induk yang membedakan nama kembar. */
  parentContext: string;
  /** Rantai nama dari atas ke bawah (tanpa diri sendiri). */
  ancestors: string[];
  /** Provinsi yang di-highlight di peta nasional. */
  provinceId: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mock hierarki realistis + beberapa nama kembar (Depok, Sukajaya, Cipayung). */
const mockWilayah: WilayahSearchItem[] = [
  // —— Provinsi (subset) ——
  {
    id: "prov-jabar",
    name: "Jawa Barat",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "jabar",
  },
  {
    id: "prov-diy",
    name: "DI Yogyakarta",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "diy",
  },
  {
    id: "prov-jateng",
    name: "Jawa Tengah",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "jateng",
  },
  {
    id: "prov-jatim",
    name: "Jawa Timur",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "jatim",
  },
  {
    id: "prov-dki",
    name: "DKI Jakarta",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "dki",
  },
  {
    id: "prov-banten",
    name: "Banten",
    level: "provinsi",
    parentContext: "Nasional",
    ancestors: [],
    provinceId: "banten",
  },

  // —— Kabupaten/Kota ——
  {
    id: "kota-depok",
    name: "Kota Depok",
    level: "kabupaten_kota",
    parentContext: "Jawa Barat",
    ancestors: ["Jawa Barat"],
    provinceId: "jabar",
  },
  {
    id: "kab-sleman",
    name: "Kabupaten Sleman",
    level: "kabupaten_kota",
    parentContext: "DI Yogyakarta",
    ancestors: ["DI Yogyakarta"],
    provinceId: "diy",
  },
  {
    id: "kota-bandung",
    name: "Kota Bandung",
    level: "kabupaten_kota",
    parentContext: "Jawa Barat",
    ancestors: ["Jawa Barat"],
    provinceId: "jabar",
  },
  {
    id: "kab-bandung",
    name: "Kabupaten Bandung",
    level: "kabupaten_kota",
    parentContext: "Jawa Barat",
    ancestors: ["Jawa Barat"],
    provinceId: "jabar",
  },
  {
    id: "kota-yogya",
    name: "Kota Yogyakarta",
    level: "kabupaten_kota",
    parentContext: "DI Yogyakarta",
    ancestors: ["DI Yogyakarta"],
    provinceId: "diy",
  },
  {
    id: "kab-bogor",
    name: "Kabupaten Bogor",
    level: "kabupaten_kota",
    parentContext: "Jawa Barat",
    ancestors: ["Jawa Barat"],
    provinceId: "jabar",
  },
  {
    id: "kota-bogor",
    name: "Kota Bogor",
    level: "kabupaten_kota",
    parentContext: "Jawa Barat",
    ancestors: ["Jawa Barat"],
    provinceId: "jabar",
  },
  {
    id: "kota-semarang",
    name: "Kota Semarang",
    level: "kabupaten_kota",
    parentContext: "Jawa Tengah",
    ancestors: ["Jawa Tengah"],
    provinceId: "jateng",
  },
  {
    id: "kota-surabaya",
    name: "Kota Surabaya",
    level: "kabupaten_kota",
    parentContext: "Jawa Timur",
    ancestors: ["Jawa Timur"],
    provinceId: "jatim",
  },

  // —— Kecamatan (termasuk Depok di Sleman) ——
  {
    id: "kec-depok-sleman",
    name: "Depok",
    level: "kecamatan",
    parentContext: "Kecamatan di Kabupaten Sleman, DIY",
    ancestors: ["DI Yogyakarta", "Kabupaten Sleman"],
    provinceId: "diy",
  },
  {
    id: "kec-beji-depok",
    name: "Beji",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-sukmajaya-depok",
    name: "Sukmajaya",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-cipayung-depok",
    name: "Cipayung",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-pancoranmas-depok",
    name: "Pancoran Mas",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-cimanggis-depok",
    name: "Cimanggis",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-sawangan-depok",
    name: "Sawangan",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-tapos-depok",
    name: "Tapos",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok"],
    provinceId: "jabar",
  },
  {
    id: "kec-cipayung-jaktim",
    name: "Cipayung",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Jakarta Timur, DKI Jakarta",
    ancestors: ["DKI Jakarta", "Kota Jakarta Timur"],
    provinceId: "dki",
  },
  {
    id: "kec-coblong-bdg",
    name: "Coblong",
    level: "kecamatan",
    parentContext: "Kecamatan di Kota Bandung, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Bandung"],
    provinceId: "jabar",
  },
  {
    id: "kec-mlati-sleman",
    name: "Mlati",
    level: "kecamatan",
    parentContext: "Kecamatan di Kabupaten Sleman, DIY",
    ancestors: ["DI Yogyakarta", "Kabupaten Sleman"],
    provinceId: "diy",
  },
  {
    id: "kec-gamping-sleman",
    name: "Gamping",
    level: "kecamatan",
    parentContext: "Kecamatan di Kabupaten Sleman, DIY",
    ancestors: ["DI Yogyakarta", "Kabupaten Sleman"],
    provinceId: "diy",
  },

  // —— Desa/Kelurahan (nama kembar Sukajaya) ——
  {
    id: "desa-sukajaya-garut",
    name: "Sukajaya",
    level: "desa",
    parentContext: "Desa di Kecamatan Sukaresmi, Kabupaten Garut, Jawa Barat",
    ancestors: ["Jawa Barat", "Kabupaten Garut", "Kecamatan Sukaresmi"],
    provinceId: "jabar",
  },
  {
    id: "desa-sukajaya-bogor",
    name: "Sukajaya",
    level: "desa",
    parentContext: "Desa di Kecamatan Sukajaya, Kabupaten Bogor, Jawa Barat",
    ancestors: ["Jawa Barat", "Kabupaten Bogor", "Kecamatan Sukajaya"],
    provinceId: "jabar",
  },
  {
    id: "kel-beji-depok",
    name: "Beji",
    level: "desa",
    parentContext: "Kelurahan di Kecamatan Beji, Kota Depok, Jawa Barat",
    ancestors: ["Jawa Barat", "Kota Depok", "Kecamatan Beji"],
    provinceId: "jabar",
  },
  {
    id: "desa-condongcatur",
    name: "Condongcatur",
    level: "desa",
    parentContext: "Kelurahan di Kecamatan Depok, Kabupaten Sleman, DIY",
    ancestors: ["DI Yogyakarta", "Kabupaten Sleman", "Kecamatan Depok"],
    provinceId: "diy",
  },
  {
    id: "desa-caturtunggal",
    name: "Caturtunggal",
    level: "desa",
    parentContext: "Kelurahan di Kecamatan Depok, Kabupaten Sleman, DIY",
    ancestors: ["DI Yogyakarta", "Kabupaten Sleman", "Kecamatan Depok"],
    provinceId: "diy",
  },
];

/** Tambahkan seluruh provinsi dari data peta agar pencarian provinsi lengkap. */
function withAllProvinces(items: WilayahSearchItem[]): WilayahSearchItem[] {
  const existing = new Set(
    items.filter((item) => item.level === "provinsi").map((item) => item.provinceId),
  );
  const extras = provinces
    .filter((province) => !existing.has(province.id))
    .map(
      (province): WilayahSearchItem => ({
        id: `prov-${province.id}`,
        name: province.name,
        level: "provinsi",
        parentContext: "Nasional",
        ancestors: [],
        provinceId: province.id,
      }),
    );
  return [...items, ...extras];
}

export const wilayahSearchIndex = withAllProvinces(mockWilayah);

const levelRank: Record<WilayahLevel, number> = {
  provinsi: 0,
  kabupaten_kota: 1,
  kecamatan: 2,
  desa: 3,
};

export function searchWilayah(query: string, limit = 8): WilayahSearchItem[] {
  const q = normalize(query);
  if (q.length < 2) return [];

  const scored = wilayahSearchIndex
    .map((item) => {
      const name = normalize(item.name);
      const context = normalize(item.parentContext);
      const haystack = `${name} ${context} ${item.ancestors.map(normalize).join(" ")}`;
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (haystack.includes(q)) score = 35;
      else return null;
      score -= levelRank[item.level] * 2;
      return { item, score };
    })
    .filter((entry): entry is { item: WilayahSearchItem; score: number } =>
      Boolean(entry),
    )
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "id"));

  return scored.slice(0, limit).map((entry) => entry.item);
}

export function getWilayahById(id: string) {
  return wilayahSearchIndex.find((item) => item.id === id) ?? null;
}

export function getProvinceIdForWilayah(item: WilayahSearchItem) {
  return item.provinceId;
}
