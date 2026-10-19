import { provinces, type Province } from "@/lib/map-data";
import type { PrioritasKey, PrioritasSlice, SasaranCounts } from "@/lib/sasaran-indikator";
import { sasaranKeys } from "@/lib/sasaran-indikator";
import { getKabupatenByProvince } from "@/lib/wilayah-hierarchy-data";

export type TpkMemberRole = "Tenaga Kesehatan" | "Kader PKK" | "Kader KB/PPKBD";

export type TrainingStatus = "Terlatih" | "Tidak Terlatih";

export type PkbJabatan = "PKB" | "PLKB";

export type PkbJabatanDetail = "Terampil" | "Mahir" | "Pertama" | "Madya";

/** Pembina TPK — Petugas KB / Petugas Lapangan KB. */
export type TpkPkb = {
  name: string;
  nik: string;
  phone: string | null;
  jabatan: PkbJabatan;
  jabatanDetail: PkbJabatanDetail;
};

export type TpkMember = {
  id: string;
  role: TpkMemberRole;
  name: string;
  nik: string;
  phone: string | null;
  trainingStatus: TrainingStatus;
};

export type KeluargaIndikator = {
  baduta: boolean;
  balita: boolean;
  pus: boolean;
  ibuHamil: boolean;
  krs: boolean;
  jambanTidakLayak: boolean;
  sumberAirTidakLayak: boolean;
  rtlh: boolean;
};

export type KeluargaPrioritas = PrioritasKey;

export type KeluargaBinaan = {
  id: string;
  familyCode: string;
  kepalaKeluarga: string;
  initials: string;
  photoUrl: string;
  alamatRingkas: string;
  mapsQuery: string;
  phone: string | null;
  prioritas: KeluargaPrioritas;
  indikator: KeluargaIndikator;
  /** URL foto jamban tidak layak — null = belum ada foto. */
  fotoJambanUrl: string | null;
  /** URL foto rumah tampak depan — null = belum ada foto. */
  fotoRumahDepanUrl: string | null;
};

export type TpkUnit = {
  id: string;
  code: string;
  name: string;
  desa: string;
  kecamatan: string;
  kabupaten: string;
  /** Id kabupaten/kota di hierarki mock (untuk filter). */
  kabupatenId: string | null;
  /** Id kecamatan di hierarki mock (untuk filter). */
  kecamatanId: string | null;
  provinceId: string;
  status: "Aktif" | "Perlu dampingan";
  members: TpkMember[];
  /** Pembina PKB/PLKB untuk TPK ini. */
  pkb: TpkPkb;
  keluarga: KeluargaBinaan[];
  /** Jumlah keluarga sasaran yang didampingi TPK ini. */
  keluargaSasaran: number;
  /** Keluarga Berisiko Stunting di TPK ini. */
  krs: number;
  /** Agregat indikator sasaran di TPK ini (konsisten dari keluarga + lingkungan). */
  sasaran: SasaranCounts;
};

const firstNames = [
  "Siti",
  "Ayu",
  "Dewi",
  "Rina",
  "Fitri",
  "Lestari",
  "Nur",
  "Maya",
  "Indah",
  "Wulan",
  "Agus",
  "Budi",
  "Eko",
  "Hendra",
  "Joko",
  "Rudi",
  "Tono",
  "Yuni",
  "Sari",
  "Dian",
];

const lastNames = [
  "Rahayu",
  "Santoso",
  "Wijaya",
  "Pratama",
  "Saputra",
  "Lestari",
  "Gunawan",
  "Halim",
  "Kusuma",
  "Nugroho",
  "Wibowo",
  "Maulana",
];

const desaNames = [
  "Sukamaju",
  "Mekarsari",
  "Cipadung",
  "Karanganyar",
  "Tanjungsari",
  "Wonosari",
  "Sidomulyo",
  "Purbasari",
];

const kecamatanNames = [
  "Coblong",
  "Beji",
  "Mlati",
  "Gamping",
  "Sukajadi",
  "Cibeunying",
  "Depok",
  "Ngaglik",
];

const PRIORITY_META: {
  id: PrioritasKey;
  label: string;
  color: string;
}[] = [
  { id: "p1", label: "Prioritas 1", color: "#0b4dd8" },
  { id: "p2", label: "Prioritas 2", color: "#155eef" },
  { id: "p3", label: "Prioritas 3", color: "#3b82f6" },
  { id: "p4", label: "Prioritas 4", color: "#93c5fd" },
  { id: "bukan", label: "Bukan Prioritas", color: "#94a3b8" },
];

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: T[]) {
  return list[Math.floor(rand() * list.length)]!;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function makePerson(rand: () => number) {
  return `${pick(rand, firstNames)} ${pick(rand, lastNames)}`;
}

function makeNik(rand: () => number, provinceAdminCode: number | string) {
  const base = String(provinceAdminCode).replace(/\D/g, "").padStart(2, "0").slice(0, 2);
  const mid = String(100000 + Math.floor(rand() * 899999));
  const tail = String(100000 + Math.floor(rand() * 899999));
  return `${base}${mid}${tail}`.slice(0, 16);
}

/** Campur nomor valid / invalid / kosong untuk demo state telepon. */
function makeOptionalPhone(rand: () => number, salt: number): string | null {
  const roll = (rand() + salt * 0.17) % 1;
  if (roll < 0.22) return null;
  if (roll < 0.38) {
    // Format tidak valid
    const junk = ["12345", "0000", "abcd-123", "021-99", "62"];
    return pick(rand, junk);
  }
  // Nomor HP Indonesia valid (08xx → simpan sebagai 08…)
  const prefix = pick(rand, ["0812", "0813", "0821", "0857", "0878", "0896"]);
  const body = String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8);
  return `${prefix}${body}`;
}

function pickPrioritas(rand: () => number): KeluargaPrioritas {
  const roll = rand();
  if (roll < 0.2) return "p1";
  if (roll < 0.42) return "p2";
  if (roll < 0.6) return "p3";
  if (roll < 0.76) return "p4";
  return "bukan";
}

function makeKeluarga(
  rand: () => number,
  tpkId: string,
  index: number,
  desa: string,
  kecamatan: string,
  kabupaten: string,
  provinceName: string,
): KeluargaBinaan {
  const kepala = makePerson(rand);
  const krs = rand() > 0.35;
  const prioritas = pickPrioritas(rand);
  const rt = 1 + Math.floor(rand() * 8);
  const rw = 1 + Math.floor(rand() * 6);
  const alamatRingkas = `RT ${rt} / RW ${rw}, ${desa}`;
  const mapsQuery = `${alamatRingkas}, Kec. ${kecamatan}, ${kabupaten}, ${provinceName}`;
  const familyCode = `KEL-${String(1000 + index).slice(-4)}`;

  const jambanTidakLayak = rand() > 0.62;
  const rtlh = rand() > 0.66;
  const seedBase = encodeURIComponent(`${tpkId}-kel-${index}`);

  // Mix: sebagian punya placeholder siap preview, sebagian belum ada foto
  const fotoJambanUrl =
    jambanTidakLayak && rand() > 0.35
      ? `https://picsum.photos/seed/${seedBase}-jamban/800/600`
      : null;
  const fotoRumahDepanUrl =
    rand() > 0.4
      ? `https://picsum.photos/seed/${seedBase}-rumah/800/600`
      : null;

  return {
    id: `${tpkId}-kel-${index + 1}`,
    familyCode,
    kepalaKeluarga: kepala,
    initials: initials(kepala),
    photoUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(`${tpkId}-${index}-${kepala}`)}&backgroundColor=e7efff,dbeafe,f1f5f9`,
    alamatRingkas,
    mapsQuery,
    phone: makeOptionalPhone(rand, index),
    prioritas,
    indikator: {
      baduta: rand() > 0.55,
      balita: rand() > 0.4,
      pus: rand() > 0.25,
      ibuHamil: rand() > 0.72,
      krs,
      jambanTidakLayak,
      sumberAirTidakLayak: rand() > 0.7,
      rtlh,
    },
    fotoJambanUrl,
    fotoRumahDepanUrl,
  };
}

function aggregateSasaran(keluarga: KeluargaBinaan[]): SasaranCounts {
  return keluarga.reduce(
    (acc, item) => {
      if (item.indikator.ibuHamil) acc.ibuHamil += 1;
      if (item.indikator.baduta) acc.baduta += 1;
      if (item.indikator.balita) acc.balita += 1;
      if (item.indikator.jambanTidakLayak) acc.jambanTidakLayak += 1;
      if (item.indikator.sumberAirTidakLayak) acc.sumberAirTidakLayak += 1;
      if (item.indikator.rtlh) acc.rtlh += 1;
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
}

function makeMembers(
  rand: () => number,
  tpkId: string,
  adminCode: number | string,
  rich: boolean,
): TpkMember[] {
  const roles: TpkMemberRole[] = [
    "Tenaga Kesehatan",
    "Kader PKK",
    "Kader KB/PPKBD",
  ];
  const count = rich ? 3 + Math.floor(rand() * 2) : 3; // 3–4 untuk demo Sukamaju
  const extraRoles: TpkMemberRole[] = ["Kader PKK", "Kader KB/PPKBD"];

  return Array.from({ length: count }, (_, i) => {
    const role = i < 3 ? roles[i]! : pick(rand, extraRoles);
    const name =
      rich && i === 0
        ? "Siti Nurhaliza Rahayu"
        : rich && i === 1
          ? "Dewi Lestari"
          : makePerson(rand);
    return {
      id: `${tpkId}-m-${i + 1}`,
      role,
      name,
      nik: makeNik(rand, adminCode),
      phone:
        i === 0
          ? "081234567890"
          : i === 1
            ? null
            : i === 2
              ? "12345"
              : makeOptionalPhone(rand, i + 3),
      trainingStatus: rand() > 0.35 ? "Terlatih" : "Tidak Terlatih",
    };
  });
}

const jabatanDetails: PkbJabatanDetail[] = [
  "Terampil",
  "Mahir",
  "Pertama",
  "Madya",
];

function makePkb(
  rand: () => number,
  adminCode: number | string,
  index: number,
  rich: boolean,
): TpkPkb {
  const jabatan: PkbJabatan = rand() > 0.42 ? "PKB" : "PLKB";
  const jabatanDetail = pick(rand, jabatanDetails);
  let phone: string | null = makeOptionalPhone(rand, index + 11);

  // Demo state telepon di baris awal (termasuk Sukamaju)
  if (rich) {
    phone = "081356789012";
  } else if (index === 1) {
    phone = null;
  } else if (index === 2) {
    phone = "0000";
  }

  return {
    name: rich ? "Rina Maulana" : makePerson(rand),
    nik: makeNik(rand, adminCode),
    phone,
    jabatan,
    jabatanDetail,
  };
}

type TpkPlace = {
  desa: string;
  kecamatan: string;
  kecamatanId: string | null;
  kabupaten: string;
  kabupatenId: string | null;
  forceRich?: boolean;
};

function makeTpk(province: Province, index: number, place?: TpkPlace): TpkUnit {
  const rand = mulberry32(hashSeed(`${province.id}-tpk-${index}`));
  const forceSukamaju = index === 0 || Boolean(place?.forceRich);
  const desa = place?.desa ?? (forceSukamaju ? "Sukamaju" : pick(rand, desaNames));
  const kecamatan =
    place?.kecamatan ?? (forceSukamaju ? "Coblong" : pick(rand, kecamatanNames));
  const kabupaten = place?.kabupaten ?? province.capital;
  const kabupatenId = place?.kabupatenId ?? null;
  const kecamatanId = place?.kecamatanId ?? null;
  const id = `${province.id}-tpk-${String(index + 1).padStart(2, "0")}`;
  const rich = forceSukamaju && index === 0;
  const keluargaCount = rich
    ? 22 + Math.floor(rand() * 6) // 22–27 untuk paging keluarga
    : 3 + Math.floor(rand() * 3); // 3–5

  const members = makeMembers(rand, id, province.adminCode, rich);
  const pkb = makePkb(rand, province.adminCode, index, rich);
  const keluarga = Array.from({ length: keluargaCount }, (_, i) =>
    makeKeluarga(
      rand,
      id,
      i,
      desa,
      kecamatan,
      kabupaten,
      province.name,
    ),
  );

  // Pastikan mix state telepon di keluarga Sukamaju
  if (rich && keluarga.length >= 6) {
    keluarga[0]!.phone = "081298765432";
    keluarga[1]!.phone = null;
    keluarga[2]!.phone = "0000";
    keluarga[3]!.phone = "085712345678";
    keluarga[4]!.phone = "abcd";
    keluarga[5]!.phone = "082187654321";
  }

  // Demo mix foto jamban / rumah tampak depan (ada vs belum ada)
  if (rich && keluarga.length >= 4) {
    const seed0 = encodeURIComponent(`${id}-kel-0`);
    const seed1 = encodeURIComponent(`${id}-kel-1`);
    keluarga[0]!.fotoJambanUrl = `https://picsum.photos/seed/${seed0}-jamban/800/600`;
    keluarga[0]!.fotoRumahDepanUrl = `https://picsum.photos/seed/${seed0}-rumah/800/600`;
    keluarga[1]!.fotoJambanUrl = null;
    keluarga[1]!.fotoRumahDepanUrl = `https://picsum.photos/seed/${seed1}-rumah/800/600`;
    keluarga[2]!.fotoJambanUrl = null;
    keluarga[2]!.fotoRumahDepanUrl = null;
    keluarga[3]!.fotoJambanUrl = `https://picsum.photos/seed/${encodeURIComponent(`${id}-kel-3`)}-jamban/800/600`;
    keluarga[3]!.fotoRumahDepanUrl = null;
  }

  const krs = keluarga.filter((item) => item.indikator.krs).length;

  return {
    id,
    code: `TPK-${province.adminCode}-${String(100 + index)}`,
    name: `TPK ${desa}`,
    desa,
    kecamatan,
    kabupaten,
    kabupatenId,
    kecamatanId,
    provinceId: province.id,
    status: rich || rand() > 0.2 ? "Aktif" : "Perlu dampingan",
    members,
    pkb,
    keluarga,
    keluargaSasaran: keluarga.length,
    krs,
    sasaran: aggregateSasaran(keluarga),
  };
}

const tpkProvinceCache = new Map<string, TpkUnit[]>();

/** TPK simulasi per provinsi — cukup banyak untuk demo paging/filter. */
export function getTpkByProvince(provinceId: string): TpkUnit[] {
  if (tpkProvinceCache.has(provinceId)) {
    return tpkProvinceCache.get(provinceId)!;
  }

  const province = provinces.find((item) => item.id === provinceId);
  if (!province) return [];

  const kabs = getKabupatenByProvince(provinceId);
  const list: TpkUnit[] = [];
  let index = 0;

  if (kabs.length === 0) {
    const rand = mulberry32(hashSeed(`${provinceId}-count`));
    const count = 24 + Math.floor(rand() * 8);
    for (let i = 0; i < count; i += 1) {
      list.push(makeTpk(province, i));
    }
    tpkProvinceCache.set(provinceId, list);
    return list;
  }

  for (const kab of kabs) {
    for (const kec of kab.kecamatan) {
      // Depok lebih padat agar paging di level kab & kec terasa (≥2 halaman).
      const perKec = kab.id === "kota-depok" ? 10 : 2;
      // Satu desa multi-TPK (simulasi RAGAJAYA): grain metrik desa sama, anggota beda.
      const multiTpkDesa =
        kab.id === "kota-depok" && kec.id === kab.kecamatan[0]?.id;
      const sharedDesaStart = list.length;
      for (let n = 0; n < perKec; n += 1) {
        const localRand = mulberry32(hashSeed(`${kab.id}-${kec.id}-tpk-${n}`));
        const rich = index === 0;
        const desaBase = pick(localRand, desaNames);
        list.push(
          makeTpk(province, index, {
            desa: rich
              ? "Sukamaju"
              : multiTpkDesa
                ? "RAGAJAYA"
                : n === 0
                  ? desaBase
                  : `${desaBase} ${n + 1}`,
            kecamatan: rich ? "Coblong" : kec.name,
            kecamatanId: rich ? "kec-coblong-bdg" : kec.id,
            kabupaten: rich ? "Kota Bandung" : kab.name,
            kabupatenId: rich ? "kota-bandung" : kab.id,
            forceRich: rich,
          }),
        );
        index += 1;
      }
      if (multiTpkDesa && list.length > sharedDesaStart) {
        const siblings = list
          .slice(sharedDesaStart)
          .filter((row) => row.desa === "RAGAJAYA");
        const anchor = siblings[0];
        if (anchor) {
          for (const row of siblings.slice(1)) {
            row.keluargaSasaran = anchor.keluargaSasaran;
            row.krs = anchor.krs;
            row.sasaran = { ...anchor.sasaran };
          }
        }
      }
    }
  }

  tpkProvinceCache.set(provinceId, list);
  return list;
}

export function getTpkForScope(options: {
  provinceId: string;
  kabupatenId?: string | null;
  kecamatanId?: string | null;
}): TpkUnit[] {
  const all = getTpkByProvince(options.provinceId);
  return all.filter((tpk) => {
    if (
      options.kabupatenId &&
      tpk.kabupatenId !== options.kabupatenId
    ) {
      return false;
    }
    if (
      options.kecamatanId &&
      tpk.kecamatanId !== options.kecamatanId
    ) {
      return false;
    }
    return true;
  });
}

export function getTpkById(provinceId: string, tpkId: string) {
  return getTpkByProvince(provinceId).find((item) => item.id === tpkId) ?? null;
}

export function getProvinceOrNull(provinceId: string) {
  return provinces.find((item) => item.id === provinceId) ?? null;
}

export function countKrsInTpk(tpk: TpkUnit) {
  return tpk.krs;
}

export function summarizeTpkList(list: TpkUnit[]) {
  const pkbKeys = new Set<string>();
  const base = list.reduce(
    (acc, tpk) => {
      acc.tim += 1;
      acc.anggota += tpk.members.length;
      acc.keluargaSasaran += tpk.keluargaSasaran;
      acc.krs += tpk.krs;
      const pkbKey = tpk.pkb.nik || `${tpk.pkb.name}|${tpk.pkb.jabatan}`;
      pkbKeys.add(pkbKey);
      for (const key of sasaranKeys) {
        acc.sasaran[key] += tpk.sasaran[key];
      }
      return acc;
    },
    {
      tim: 0,
      anggota: 0,
      keluargaSasaran: 0,
      krs: 0,
      sasaran: {
        ibuHamil: 0,
        baduta: 0,
        balita: 0,
        jambanTidakLayak: 0,
        sumberAirTidakLayak: 0,
        rtlh: 0,
      } satisfies SasaranCounts,
    },
  );
  return { ...base, pkb: pkbKeys.size };
}

export function getTpkPrioritasKomposisi(tpk: TpkUnit): {
  total: number;
  slices: PrioritasSlice[];
} {
  const total = tpk.keluarga.length;
  const counts: Partial<Record<PrioritasKey, number>> = Object.fromEntries(
    PRIORITY_META.map((item) => [item.id, 0]),
  );

  for (const item of tpk.keluarga) {
    counts[item.prioritas] = (counts[item.prioritas] ?? 0) + 1;
  }

  const slices: PrioritasSlice[] = PRIORITY_META.map((item) => {
    const value = counts[item.id] ?? 0;
    return {
      id: item.id,
      label: item.label,
      share: total > 0 ? value / total : 0,
      color: item.color,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    };
  });

  return { total, slices };
}

export const filterSasaranKeys = sasaranKeys;

export const indikatorLabels: Record<keyof KeluargaIndikator, string> = {
  baduta: "Baduta",
  balita: "Balita",
  pus: "PUS",
  ibuHamil: "Ibu hamil",
  krs: "Berisiko stunting",
  jambanTidakLayak: "Jamban tidak layak",
  sumberAirTidakLayak: "Sumber air tidak layak",
  rtlh: "RTLH",
};

export const prioritasLabels: Record<PrioritasKey, string> = {
  p1: "Prioritas 1",
  p2: "Prioritas 2",
  p3: "Prioritas 3",
  p4: "Prioritas 4",
  bukan: "Bukan prioritas",
  tidakRisiko: "Tidak berisiko",
};

export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
