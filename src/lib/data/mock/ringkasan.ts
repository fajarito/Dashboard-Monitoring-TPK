import {
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  nationalDesaKelurahan,
  nationalTotals,
  PKB_DESA_IDEAL_MAX,
} from "@/lib/map-data";
import {
  getNationalSasaran,
  getPrioritasKomposisi,
  getProvinceSasaran,
} from "@/lib/sasaran-indikator";
import { komposisiPilar } from "@/lib/komposisi-data";
import {
  getProvinsiApiId,
  resolveProvinceFromRingkasanId,
} from "@/lib/province-api-id";

import type {
  DataSource,
  RingkasanPayload,
  RingkasanQuery,
} from "@/lib/data/types";
import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";

const SOURCE: DataSource = "mock";

function pillarValue(id: "nakes" | "pkk" | "kb" | "lainnya") {
  return komposisiPilar.find((item) => item.id === id)?.value ?? 0;
}

function buildNasional(): RingkasanPayload {
  const prioritas = getPrioritasKomposisi(null);
  const sasaran = getNationalSasaran();
  const rasioTPK_KRS = getKrsPerTpkRatio(nationalTotals.tpk, nationalTotals.krs);
  const rasioPKB_desa = getDesaPerPkbRatio(
    nationalTotals.pkb,
    nationalDesaKelurahan,
  );

  const byId = Object.fromEntries(
    prioritas.slices.map((slice) => [slice.id, slice.value]),
  );

  return {
    tingkat: "nasional",
    id: null,
    jumlahTPK: nationalTotals.tpk,
    jumlahAnggota: nationalTotals.anggota,
    jumlahPKB: nationalTotals.pkb,
    jumlahKRS: nationalTotals.krs,
    jumlahSasaran: prioritas.total,
    rasioTPK_KRS,
    rasioPKB_desa,
    warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
    komposisiPrioritas: {
      prioritas1: byId.p1 ?? 0,
      prioritas2: byId.p2 ?? 0,
      prioritas3: byId.p3 ?? 0,
      prioritas4: byId.p4 ?? 0,
      bukan: byId.bukan ?? 0,
      tidakRisiko: byId.tidakRisiko ?? 0,
    },
    indikator: {
      bumil: sasaran.ibuHamil,
      baduta: sasaran.baduta,
      balita: sasaran.balita,
      jambanTL: sasaran.jambanTidakLayak,
      airTL: sasaran.sumberAirTidakLayak,
      // RTLH belum ada di DWH — mock tetap mengisi angka simulasi agar UI tidak kosong.
      rtlh: sasaran.rtlh,
    },
    komposisiTPK: {
      bidan: pillarValue("nakes"),
      pkk: pillarValue("pkk"),
      kaderKb: pillarValue("kb"),
      lainnya: pillarValue("lainnya"),
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildProvinsi(id: string): RingkasanPayload | null {
  const province = resolveProvinceFromRingkasanId(id);
  if (!province) return null;

  const prioritas = getPrioritasKomposisi(province);
  const sasaran = getProvinceSasaran(province);
  const desa =
    nationalTotals.pkb > 0
      ? Math.max(
          1,
          Math.round(nationalDesaKelurahan * (province.pkb / nationalTotals.pkb)),
        )
      : 0;
  const rasioTPK_KRS = getKrsPerTpkRatio(province.tpk, province.krs);
  const rasioPKB_desa = getDesaPerPkbRatio(province.pkb, desa);

  const byId = Object.fromEntries(
    prioritas.slices.map((slice) => [slice.id, slice.value]),
  );

  // Komposisi TPK proporsional terhadap anggota provinsi (simulasi).
  const anggota = province.anggota;
  const bidan = Math.round(anggota * 0.325);
  const pkk = Math.round(anggota * 0.318);
  const kaderKb = Math.round(anggota * 0.297);
  const lainnya = Math.max(0, anggota - bidan - pkk - kaderKb);

  return {
    tingkat: "provinsi",
    id: getProvinsiApiId(province) ?? province.id,
    jumlahTPK: province.tpk,
    jumlahAnggota: province.anggota,
    jumlahPKB: province.pkb,
    jumlahKRS: province.krs,
    jumlahSasaran: prioritas.total,
    rasioTPK_KRS,
    rasioPKB_desa,
    warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
    komposisiPrioritas: {
      prioritas1: byId.p1 ?? 0,
      prioritas2: byId.p2 ?? 0,
      prioritas3: byId.p3 ?? 0,
      prioritas4: byId.p4 ?? 0,
      bukan: byId.bukan ?? 0,
      tidakRisiko: byId.tidakRisiko ?? 0,
    },
    indikator: {
      bumil: sasaran.ibuHamil,
      baduta: sasaran.baduta,
      balita: sasaran.balita,
      jambanTL: sasaran.jambanTidakLayak,
      airTL: sasaran.sumberAirTidakLayak,
      rtlh: sasaran.rtlh,
    },
    komposisiTPK: { bidan, pkk, kaderKb, lainnya },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: SOURCE,
      generatedAt: new Date().toISOString(),
    },
  };
}

/** Adapter mock — bentuk respons sama dengan kontrak live. */
export function getRingkasanMock(query: RingkasanQuery): RingkasanPayload {
  if (query.tingkat === "provinsi") {
    const id = query.id?.trim();
    if (!id) {
      // Tanpa id → fallback nasional agar home tidak gagal.
      return buildNasional();
    }
    return buildProvinsi(id) ?? buildNasional();
  }
  return buildNasional();
}
