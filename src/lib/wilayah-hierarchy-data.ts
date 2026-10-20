import { getKemendagriRegencies } from "@/lib/data/kemendagri-regencies";
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
  /** Kode Kemendagri (4/6/10 digit) untuk join choropleth — opsional. */
  kode?: string;
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

/**
 * Semua kab/kota Kemendagri untuk satu provinsi (dari Master Wilayah snapshot).
 * Menjamin choropleth mock punya 1 baris + `kode` per poligon — bukan hanya Jabar.
 */
function buildKemendagriKabupaten(province: Province): KabupatenUnit[] {
  const mwList = getKemendagriRegencies(province.adminCode);
  if (mwList.length === 0) return [];

  const rand = mulberry32(hashSeed(`${province.id}-kab-mw`));
  const provinceSasaran = getProvinceSasaran(province);
  // Bobot acak ringan agar choropleth tidak flat, tetap jumlah ≈ 1.0
  const weights = mwList.map(() => 0.55 + rand());
  const weightSum = weights.reduce((a, b) => a + b, 0);

  return mwList.map((mw, index) => {
    const share = weights[index]! / weightSum;
    const krs = Math.max(80, Math.round(province.krs * share));
    const keluargaSasaran = Math.round(krs * (1.35 + rand() * 0.3));
    const tpkCount = Math.max(4, Math.round(province.tpk * share));
    const sasaran = Object.fromEntries(
      sasaranKeys.map((key) => [
        key,
        Math.max(15, Math.round(provinceSasaran[key] * share)),
      ]),
    ) as SasaranCounts;

    const slugBase = mw.name
      .toLowerCase()
      .replace(/\b(kabupaten|kota)\b/g, "")
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const idPrefix = mw.name.toLowerCase().startsWith("kota") ? "kota" : "kab";
    const id = `${idPrefix}-${slugBase || mw.code}`;

    // Depok (Jabar) — kecamatan realistis untuk drill demo
    const kecNames =
      mw.code === "3276"
        ? [...DEPOK_KECAMATAN]
        : Array.from({ length: 5 + Math.floor(rand() * 3) }, (_, i) => {
            return GENERIC_KEC_NAMES[
              (i + hashSeed(mw.code)) % GENERIC_KEC_NAMES.length
            ]!;
          }).filter((name, i, arr) => arr.indexOf(name) === i);

    return {
      id,
      name: mw.name,
      kindLabel: mw.name.startsWith("Kota") ? "Kota" : "Kabupaten",
      provinceId: province.id,
      keluargaSasaran,
      krs,
      sasaran,
      tpkCount,
      kode: mw.code,
      kecamatan: buildKecamatan(province.id, id, mw.name, kecNames, krs),
    };
  });
}

const cache = new Map<string, KabupatenUnit[]>();

export function getKabupatenByProvince(provinceId: string): KabupatenUnit[] {
  if (cache.has(provinceId)) return cache.get(provinceId)!;
  const province = provinces.find((p) => p.id === provinceId);
  if (!province) return [];
  // Semua provinsi (termasuk Jabar) memakai daftar Kemendagri lengkap + kode.
  const list = buildKemendagriKabupaten(province);
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

  // Cocokkan kode Kemendagri 4 digit
  const kode = String(kabId).replace(/\D/g, "");
  if (kode.length === 4) {
    const byKode = list.find((item) => item.kode === kode);
    if (byKode) return byKode;
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

/** Cari kab di semua provinsi mock (slug, id_kabupaten, atau kode Kemendagri). */
export function findKabupatenAcrossProvinces(
  kabId: string,
): KabupatenUnit | null {
  const trimmed = kabId.trim();
  if (!trimmed) return null;
  for (const province of provinces) {
    const hit = getKabupatenById(province.id, trimmed);
    if (hit && hit.kode) return hit;
    if (hit && hit.tpkCount > 0) return hit;
  }
  // Kode Kemendagri langsung
  const kode = trimmed.replace(/\D/g, "");
  if (kode.length === 4) {
    for (const province of provinces) {
      const hit = getKabupatenByProvince(province.id).find(
        (k) => k.kode === kode,
      );
      if (hit) return hit;
    }
  }
  return null;
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
