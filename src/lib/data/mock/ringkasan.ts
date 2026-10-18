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
import { resolveKabupatenApiId } from "@/lib/kabupaten-api-id";
import {
  getKabupatenById,
  getKabupatenByProvince,
} from "@/lib/wilayah-hierarchy-data";

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

/**
 * Cari baris kab mock by id_kabupaten atau slug, lalu skala dari agregat provinsi.
 */
function buildKabupaten(id: string): RingkasanPayload | null {
  const apiId = resolveKabupatenApiId(id);
  const idStr = apiId != null ? String(apiId) : id.trim();

  // Coba match slug hierarki dulu (kota-depok, …) di semua provinsi mock.
  const provinceCandidates = ["jabar", "diy", "jateng", "jatim", "dki"];
  let kabSlug: string | null = null;
  let provinceSlug: string | null = null;

  // Reverse map: id_kabupaten → slug yang dikenal
  const slugFromApi = Object.entries(
    // lazy import avoided — inline reverse of known slugs via resolve
    {
      166: "kota-depok",
      161: "kota-bandung",
      150: "kab-bandung",
      151: "kab-bandung-barat",
      147: "kab-bogor",
      163: "kota-bogor",
      165: "kota-bekasi",
      144: "kab-bekasi",
      145: "kab-karawang",
      162: "kota-cirebon",
      156: "kab-cirebon",
      153: "kab-garut",
      148: "kab-sukabumi",
      164: "kota-sukabumi",
      149: "kab-cianjur",
      154: "kab-tasikmalaya",
      168: "kota-tasikmalaya",
      167: "kota-cimahi",
      499: "kab-pangandaran",
      206: "kab-sleman",
    } as Record<number, string>,
  ).find(([k]) => Number(k) === apiId)?.[1];

  if (slugFromApi) {
    kabSlug = slugFromApi;
    provinceSlug =
      slugFromApi === "kab-sleman"
        ? "diy"
        : provinceCandidates.find((p) =>
            getKabupatenById(p, slugFromApi),
          ) ?? "jabar";
  } else if (getKabupatenById("jabar", id.trim())) {
    kabSlug = id.trim();
    provinceSlug = "jabar";
  }

  if (!kabSlug || !provinceSlug) {
    // Tanpa baris hierarki: skala deterministik dari nasional agar API tetap 200.
    const seed = apiId ?? (Number.parseInt(idStr, 10) || 1);
    const share = 0.012 + ((seed * 17) % 40) / 1000;
    const nasional = buildNasional();
    const scale = (n: number) => Math.max(0, Math.round(n * share));
    const jumlahTPK = scale(nasional.jumlahTPK);
    const jumlahAnggota = scale(nasional.jumlahAnggota);
    const jumlahPKB = Math.max(1, scale(nasional.jumlahPKB));
    const jumlahKRS = scale(nasional.jumlahKRS);
    const jumlahSasaran = scale(nasional.jumlahSasaran);
    const desa = Math.max(1, scale(nationalDesaKelurahan));
    const bidan = Math.round(jumlahAnggota * 0.325);
    const pkk = Math.round(jumlahAnggota * 0.318);
    const kaderKb = Math.round(jumlahAnggota * 0.297);
    const lainnya = Math.max(0, jumlahAnggota - bidan - pkk - kaderKb);
    const rasioTPK_KRS = getKrsPerTpkRatio(jumlahTPK, jumlahKRS);
    const rasioPKB_desa = getDesaPerPkbRatio(jumlahPKB, desa);
    return {
      tingkat: "kabupaten",
      id: idStr,
      jumlahTPK,
      jumlahAnggota,
      jumlahPKB,
      jumlahKRS,
      jumlahSasaran,
      rasioTPK_KRS,
      rasioPKB_desa,
      warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
      komposisiPrioritas: {
        prioritas1: scale(nasional.komposisiPrioritas.prioritas1),
        prioritas2: scale(nasional.komposisiPrioritas.prioritas2),
        prioritas3: scale(nasional.komposisiPrioritas.prioritas3),
        prioritas4: scale(nasional.komposisiPrioritas.prioritas4),
        bukan: scale(nasional.komposisiPrioritas.bukan),
        tidakRisiko: scale(nasional.komposisiPrioritas.tidakRisiko),
      },
      indikator: {
        bumil: scale(nasional.indikator.bumil),
        baduta: scale(nasional.indikator.baduta),
        balita: scale(nasional.indikator.balita),
        jambanTL: scale(nasional.indikator.jambanTL),
        airTL: scale(nasional.indikator.airTL),
        rtlh: scale(nasional.indikator.rtlh ?? 0),
      },
      komposisiTPK: { bidan, pkk, kaderKb, lainnya },
      meta: {
        cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
        source: SOURCE,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const kab = getKabupatenById(provinceSlug, kabSlug);
  const province = resolveProvinceFromRingkasanId(provinceSlug);
  if (!kab || !province) return null;

  const prov = buildProvinsi(provinceSlug);
  if (!prov) return null;

  const kabList = getKabupatenByProvince(provinceSlug);
  const tpkSum = kabList.reduce((s, k) => s + k.tpkCount, 0) || 1;
  const share = kab.tpkCount / tpkSum;

  const scale = (n: number) => Math.max(0, Math.round(n * share));
  const jumlahTPK = kab.tpkCount;
  const jumlahKRS = kab.krs;
  const jumlahSasaran = kab.keluargaSasaran;
  const jumlahAnggota = scale(province.anggota);
  const jumlahPKB = Math.max(1, scale(province.pkb));
  const desa = Math.max(
    1,
    Math.round(
      (nationalDesaKelurahan * (province.pkb / nationalTotals.pkb) * share) ||
        kab.tpkCount * 0.4,
    ),
  );
  const bidan = Math.round(jumlahAnggota * 0.325);
  const pkk = Math.round(jumlahAnggota * 0.318);
  const kaderKb = Math.round(jumlahAnggota * 0.297);
  const lainnya = Math.max(0, jumlahAnggota - bidan - pkk - kaderKb);
  const rasioTPK_KRS = getKrsPerTpkRatio(jumlahTPK, jumlahKRS);
  const rasioPKB_desa = getDesaPerPkbRatio(jumlahPKB, desa);

  return {
    tingkat: "kabupaten",
    id: idStr,
    jumlahTPK,
    jumlahAnggota,
    jumlahPKB,
    jumlahKRS,
    jumlahSasaran,
    rasioTPK_KRS,
    rasioPKB_desa,
    warningBeban: rasioPKB_desa > PKB_DESA_IDEAL_MAX,
    komposisiPrioritas: {
      prioritas1: scale(prov.komposisiPrioritas.prioritas1),
      prioritas2: scale(prov.komposisiPrioritas.prioritas2),
      prioritas3: scale(prov.komposisiPrioritas.prioritas3),
      prioritas4: scale(prov.komposisiPrioritas.prioritas4),
      bukan: scale(prov.komposisiPrioritas.bukan),
      tidakRisiko: scale(prov.komposisiPrioritas.tidakRisiko),
    },
    indikator: {
      bumil: kab.sasaran.ibuHamil,
      baduta: kab.sasaran.baduta,
      balita: kab.sasaran.balita,
      jambanTL: kab.sasaran.jambanTidakLayak,
      airTL: kab.sasaran.sumberAirTidakLayak,
      rtlh: kab.sasaran.rtlh,
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
  if (query.tingkat === "kabupaten") {
    const id = query.id?.trim();
    if (!id) return buildNasional();
    return buildKabupaten(id) ?? buildNasional();
  }
  if (query.tingkat === "provinsi") {
    const id = query.id?.trim();
    if (!id) {
      return buildNasional();
    }
    return buildProvinsi(id) ?? buildNasional();
  }
  return buildNasional();
}
