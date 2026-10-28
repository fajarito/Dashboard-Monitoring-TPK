import { parseCoord } from "@/lib/data/geo-coords";
import { canonicalKki } from "@/lib/data/kki";
import {
  labelFasilitasBab,
  labelJenisAtap,
  labelJenisDinding,
  labelJenisLantai,
  labelKondisiBangunan,
  labelSumberAirMinum,
} from "@/lib/data/stunting-head-labels";
import type {
  KeluargaDetailHousingField,
  KeluargaDetailItem,
} from "@/lib/data/types";

export type StuntingHeadRowRow = {
  id_stunting: number | string | null;
  kki: string | null;
  id_provinsi: number | null;
  id_kelurahan: number | null;
  no_kk: string | null;
  nama_kk: string | null;
  nama_istri: string | null;
  alamat: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  kesejahteraan_prioritas: number | null;
  resiko_stunting: number | null;
  jns_atap: number | null;
  kondisi_atap: number | null;
  jns_dinding: number | null;
  kondisi_dinding: number | null;
  jns_lantai: number | null;
  kondisi_lantai: number | null;
  sumber_air_minum: number | null;
  kondisi_sumber_air_minum: number | null;
  memiliki_tempat_bab: number | null;
  kondisi_fasilitas_bab: number | null;
  foto_rumah: string | null;
  foto_jamban: string | null;
  luas_rumah: number | null;
  jml_orang_tinggal: number | null;
  keterangan: string | null;
};

function housingField(
  code: number | null | undefined,
  label: string | null,
): KeluargaDetailHousingField {
  const normalized =
    code == null || !Number.isFinite(Number(code)) ? null : Number(code);
  return { code: normalized, label };
}

function parseId(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Map baris stunting_head → payload modal.
 * `resiko_stunting`: 1 = berisiko, 2 = tidak (pola sample).
 */
export function mapStuntingHeadRow(
  row: StuntingHeadRowRow,
): KeluargaDetailItem | null {
  const kki = canonicalKki(row.kki);
  if (!kki) return null;
  const nama = trimOrNull(row.nama_kk) ?? "Tanpa nama";
  const risiko =
    row.resiko_stunting == null
      ? null
      : row.resiko_stunting === 1
        ? true
        : row.resiko_stunting === 2
          ? false
          : null;

  return {
    idStunting: parseId(row.id_stunting),
    kki,
    noKk: trimOrNull(row.no_kk),
    namaKepalaKeluarga: nama,
    namaIstri: trimOrNull(row.nama_istri),
    alamat: trimOrNull(row.alamat),
    prioritas: row.kesejahteraan_prioritas,
    risikoStunting: risiko,
    latitude: parseCoord(row.latitude),
    longitude: parseCoord(row.longitude),
    rumah: {
      atap: housingField(row.jns_atap, labelJenisAtap(row.jns_atap)),
      kondisiAtap: housingField(
        row.kondisi_atap,
        labelKondisiBangunan(row.kondisi_atap),
      ),
      dinding: housingField(row.jns_dinding, labelJenisDinding(row.jns_dinding)),
      kondisiDinding: housingField(
        row.kondisi_dinding,
        labelKondisiBangunan(row.kondisi_dinding),
      ),
      lantai: housingField(row.jns_lantai, labelJenisLantai(row.jns_lantai)),
      kondisiLantai: housingField(
        row.kondisi_lantai,
        labelKondisiBangunan(row.kondisi_lantai),
      ),
      luasM2: row.luas_rumah,
      jumlahPenghuni: row.jml_orang_tinggal,
    },
    jamban: {
      memilikiTempatBab: housingField(
        row.memiliki_tempat_bab,
        labelFasilitasBab(row.memiliki_tempat_bab),
      ),
      kondisi: housingField(
        row.kondisi_fasilitas_bab,
        labelKondisiBangunan(row.kondisi_fasilitas_bab),
      ),
    },
    air: {
      sumber: housingField(
        row.sumber_air_minum,
        labelSumberAirMinum(row.sumber_air_minum),
      ),
      kondisi: housingField(
        row.kondisi_sumber_air_minum,
        labelKondisiBangunan(row.kondisi_sumber_air_minum),
      ),
    },
    fotoRumahUrl: trimOrNull(row.foto_rumah),
    fotoJambanUrl: trimOrNull(row.foto_jamban),
    keterangan: trimOrNull(row.keterangan),
    idProvinsi: row.id_provinsi,
    idKelurahan: row.id_kelurahan,
  };
}
