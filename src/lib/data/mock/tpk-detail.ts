import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type {
  TpkDetailAnggota,
  TpkDetailKomposisiPrioritas,
  TpkDetailPayload,
  TpkListPkb,
} from "@/lib/data/types";
import { provinces } from "@/lib/map-data";
import { PROVINSI_ID_BY_SLUG } from "@/lib/province-api-id";
import { formatTpkDisplayName } from "@/lib/tpk-display-name";
import {
  getTpkById,
  getTpkByProvince,
  getTpkPrioritasKomposisi,
  type TpkMember,
  type TpkUnit,
} from "@/lib/tpk-drilldown-data";

function findMockTpk(tpkId: string): { tpk: TpkUnit; provinceId: string } | null {
  const trimmed = tpkId.trim();
  if (!trimmed) return null;

  for (const province of provinces) {
    const tpk = getTpkById(province.id, trimmed);
    if (tpk) return { tpk, provinceId: province.id };
  }

  // Fallback: scan semua unit (id bisa unik lintas provinsi di mock).
  for (const province of provinces) {
    const hit = getTpkByProvince(province.id).find((item) => item.id === trimmed);
    if (hit) return { tpk: hit, provinceId: province.id };
  }
  return null;
}

function mapAnggota(members: TpkMember[]): TpkDetailAnggota[] {
  return members.map((member, index) => ({
    nomorUrut: index + 1,
    nama: member.name,
    nik: member.nik || null,
    noHp: member.phone,
    statusTpk:
      member.role === "Tenaga Kesehatan"
        ? 1
        : member.role === "Kader PKK"
          ? 2
          : member.role === "Kader KB/PPKBD"
            ? 3
            : null,
    peran: member.role,
    pelatihanLabel:
      member.trainingStatus === "Terlatih" ? "Sudah Orientasi" : null,
    terlatih: member.trainingStatus === "Terlatih",
  }));
}

function mapPkb(tpk: TpkUnit): TpkListPkb {
  return {
    pkbId: tpk.pkb.nip || tpk.pkb.nik || `mock-${tpk.id}`,
    nip: tpk.pkb.nip || null,
    nama: tpk.pkb.name,
    jabatan: tpk.pkb.jabatan,
    jabatanDetail: tpk.pkb.jabatanDetail,
    nik: tpk.pkb.nik,
    noHp: tpk.pkb.phone,
  };
}

function mapKomposisi(tpk: TpkUnit): TpkDetailKomposisiPrioritas {
  const { slices } = getTpkPrioritasKomposisi(tpk);
  const byId = Object.fromEntries(slices.map((s) => [s.id, s.value])) as Record<
    string,
    number
  >;
  return {
    prioritas1: byId.p1 ?? 0,
    prioritas2: byId.p2 ?? 0,
    prioritas3: byId.p3 ?? 0,
    prioritas4: byId.p4 ?? 0,
    bukan: byId.bukan ?? 0,
    tidakRisiko: byId.tidakRisiko ?? 0,
  };
}

/**
 * Detail TPK mock — sumber sama drill-down simulasi.
 * Keluarga by_name tidak diisi (stub []) agar selaras kontrak live.
 */
export function getTpkDetailMock(tpkId: string): TpkDetailPayload | null {
  const found = findMockTpk(tpkId);
  if (!found) return null;

  const { tpk, provinceId } = found;
  const province = provinces.find((p) => p.id === provinceId);
  const desa = tpk.desa?.trim() || null;
  const tpkSeDesa = getTpkByProvince(provinceId).filter(
    (item) => (item.desa?.trim() || "").toLowerCase() === (desa || "").toLowerCase(),
  ).length;

  const nama = formatTpkDisplayName({
    tpkId: tpk.id,
    nama: desa ? `TPK (${desa})` : tpk.name,
    namaKelurahan: desa,
    nomorRegister: tpk.code?.slice(-3) ?? null,
  });

  return {
    tpkId: tpk.id,
    nama,
    nomorRegister: tpk.code?.slice(-3) ?? null,
    kodeTpk: null,
    alamat: null,
    status: tpk.status === "Aktif" ? 1 : 0,
    statusLabel: tpk.status === "Aktif" ? "Aktif" : "Nonaktif",
    wilayah: {
      provinsiId: PROVINSI_ID_BY_SLUG[provinceId] ?? null,
      kabupatenId: null,
      kecamatanId: null,
      kelurahanId: null,
      namaProvinsi: province?.name ?? null,
      namaKabupaten: tpk.kabupaten || null,
      namaKecamatan: tpk.kecamatan || null,
      namaKelurahan: desa,
    },
    anggota: mapAnggota(tpk.members),
    pkb: mapPkb(tpk),
    keluargaSasaran: tpk.keluargaSasaran,
    krs: tpk.krs,
    indikator: {
      bumil: tpk.sasaran.ibuHamil,
      baduta: tpk.sasaran.baduta,
      balita: tpk.sasaran.balita,
      jambanTL: tpk.sasaran.jambanTidakLayak,
      airTL: tpk.sasaran.sumberAirTidakLayak,
      rtlh: null,
    },
    tpkSeDesa: Math.max(1, tpkSeDesa),
    komposisiPrioritas: mapKomposisi(tpk),
    keluarga: [],
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "mock",
      generatedAt: new Date().toISOString(),
    },
  };
}
