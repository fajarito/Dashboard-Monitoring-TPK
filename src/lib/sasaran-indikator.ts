import { provinces, type Province } from "@/lib/map-data";

export type SasaranKey =
  | "ibuHamil"
  | "baduta"
  | "balita"
  | "jambanTidakLayak"
  | "sumberAirTidakLayak"
  | "rtlh";

export type SasaranCounts = Record<SasaranKey, number>;

export const sasaranKeys: SasaranKey[] = [
  "ibuHamil",
  "baduta",
  "balita",
  "jambanTidakLayak",
  "sumberAirTidakLayak",
  "rtlh",
];

export const sasaranLabels: Record<SasaranKey, string> = {
  ibuHamil: "Ibu Hamil",
  baduta: "Baduta",
  balita: "Balita",
  jambanTidakLayak: "Jamban Tidak Layak",
  sumberAirTidakLayak: "Sumber Air Tidak Layak",
  rtlh: "Rumah Tidak Layak Huni (RTLH)",
};

export const sasaranShortLabels: Record<SasaranKey, string> = {
  ibuHamil: "Ibu Hamil",
  baduta: "Baduta",
  balita: "Balita",
  jambanTidakLayak: "Jamban TL",
  sumberAirTidakLayak: "Air TL",
  rtlh: "RTLH",
};

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function unitNoise(seed: number, salt: number) {
  const x = Math.sin(seed * 0.0001 + salt * 12.9898) * 43758.5453;
  return 0.88 + (x - Math.floor(x)) * 0.24;
}

/** Agregat indikator sasaran per provinsi (simulasi, selaras angka yang sudah ada). */
export function getProvinceSasaran(province: Province): SasaranCounts {
  const seed = hashSeed(province.id);
  return {
    ibuHamil: province.ibuHamil,
    baduta: province.baduta,
    balita: province.balita,
    jambanTidakLayak: Math.round(
      province.krs * 0.38 * unitNoise(seed, 1),
    ),
    sumberAirTidakLayak: Math.round(
      province.krs * 0.26 * unitNoise(seed, 2),
    ),
    rtlh: Math.round(province.krs * 0.31 * unitNoise(seed, 3)),
  };
}

export function getNationalSasaran(): SasaranCounts {
  return provinces.reduce(
    (acc, province) => {
      const item = getProvinceSasaran(province);
      for (const key of sasaranKeys) acc[key] += item[key];
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

export function getSasaranForScope(province: Province | null): {
  scopeLabel: string;
  counts: SasaranCounts;
} {
  if (province) {
    return {
      scopeLabel: province.name,
      counts: getProvinceSasaran(province),
    };
  }
  return {
    scopeLabel: "Nasional",
    counts: getNationalSasaran(),
  };
}

export type PrioritasKey = "p1" | "p2" | "p3" | "p4" | "bukan";

export type PrioritasSlice = {
  id: PrioritasKey;
  label: string;
  share: number;
  color: string;
  value: number;
  percent: number;
};

const PRIORITY_SHARES: {
  id: PrioritasKey;
  label: string;
  share: number;
  color: string;
}[] = [
  { id: "p1", label: "Prioritas 1", share: 0.22, color: "#0b4dd8" },
  { id: "p2", label: "Prioritas 2", share: 0.26, color: "#155eef" },
  { id: "p3", label: "Prioritas 3", share: 0.18, color: "#3b82f6" },
  { id: "p4", label: "Prioritas 4", share: 0.14, color: "#93c5fd" },
  { id: "bukan", label: "Bukan Prioritas", share: 0.2, color: "#94a3b8" },
];

function keluargaSasaranBase(province: Province | null) {
  if (province) {
    return Math.round(province.krs * 1.45 + province.ibuHamil * 0.8);
  }
  return provinces.reduce(
    (sum, item) => sum + Math.round(item.krs * 1.45 + item.ibuHamil * 0.8),
    0,
  );
}

/** Estimasi keluarga sasaran per provinsi (simulasi, selaras komposisi prioritas). */
export function getKeluargaSasaranForProvince(province: Province) {
  return keluargaSasaranBase(province);
}

export function getPrioritasKomposisi(province: Province | null): {
  scopeLabel: string;
  total: number;
  slices: PrioritasSlice[];
} {
  const total = keluargaSasaranBase(province);
  let allocated = 0;
  const slices = PRIORITY_SHARES.map((item, index) => {
    const isLast = index === PRIORITY_SHARES.length - 1;
    const value = isLast
      ? Math.max(0, total - allocated)
      : Math.round(total * item.share);
    allocated += isLast ? 0 : value;
    return {
      ...item,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    };
  });

  return {
    scopeLabel: province?.name ?? "Nasional",
    total,
    slices,
  };
}
