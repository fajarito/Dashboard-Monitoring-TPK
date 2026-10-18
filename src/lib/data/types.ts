/** Kontrak respons API ringkasan & peringkat (fase 1). */

/** Sumber efektif payload, atau postgres-error pada respons 503. */
export type DataSource = "mock" | "postgres" | "postgres-error";

export type RingkasanTingkat = "nasional" | "provinsi";

export type KomposisiPrioritas = {
  prioritas1: number;
  prioritas2: number;
  prioritas3: number;
  prioritas4: number;
  bukan: number;
};

export type IndikatorRingkasan = {
  /** Ibu hamil (bumil / pus_hamil). */
  bumil: number;
  baduta: number;
  balita: number;
  /** Jamban tidak layak. */
  jambanTL: number;
  /** Sumber air tidak layak. */
  airTL: number;
  /**
   * RTLH belum ada di DWH — null atau 0.
   * UI boleh menampilkan 0 dengan catatan "belum tersedia".
   */
  rtlh: number | null;
};

export type KomposisiTPK = {
  bidan: number;
  pkk: number;
  kaderKb: number;
};

export type RingkasanMeta = {
  cacheTtlSec: number;
  source: DataSource;
  generatedAt: string;
};

export type RingkasanPayload = {
  tingkat: RingkasanTingkat;
  id: string | null;
  jumlahTPK: number;
  jumlahAnggota: number;
  jumlahPKB: number;
  jumlahKRS: number;
  jumlahSasaran: number;
  /** Rata-rata KRS per 1 TPK. */
  rasioTPK_KRS: number;
  /** Rata-rata desa/kelurahan per 1 PKB. */
  rasioPKB_desa: number;
  /** true jika rasioPKB_desa > 2. */
  warningBeban: boolean;
  komposisiPrioritas: KomposisiPrioritas;
  indikator: IndikatorRingkasan;
  komposisiTPK: KomposisiTPK;
  meta: RingkasanMeta;
};

export type PeringkatProvinsiItem = {
  id: string;
  nama: string;
  tpk: number;
  krs: number;
  /** KRS ÷ TPK. */
  rasio: number;
};

export type PeringkatProvinsiPayload = {
  items: PeringkatProvinsiItem[];
  meta: RingkasanMeta;
};

export type RingkasanQuery = {
  tingkat: RingkasanTingkat;
  id?: string | null;
};
