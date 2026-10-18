/** Kontrak respons API ringkasan & peringkat (fase 1). */

/** Sumber efektif payload, atau postgres-error pada respons 503. */
export type DataSource = "mock" | "postgres" | "postgres-error";

export type RingkasanTingkat = "nasional" | "provinsi";

export type KomposisiPrioritas = {
  prioritas1: number;
  prioritas2: number;
  prioritas3: number;
  prioritas4: number;
  /** Bagian total_prioritas (KRS) yang bukan P1–P4. */
  bukan: number;
  /**
   * SUM(tidak_risiko_stunting) — sisa sasaran di luar KRS.
   * jumlahSasaran = (P1…P4 + bukan) + tidakRisiko.
   */
  tidakRisiko: number;
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
  /**
   * Anggota StatusTPK di luar 1/2/3 (termasuk NULL).
   * jumlahAnggota = bidan + pkk + kaderKb + lainnya.
   */
  lainnya: number;
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
  /** COUNT dat_PKB Status=1 per ProvinsiID. */
  pkb: number;
  /** COUNT desa binaan aktif join PKB aktif, group by PKB.ProvinsiID. */
  desa: number;
  krs: number;
  /** KRS ÷ TPK (sama getKrsPerTpkRatio). */
  rasio: number;
  /** desa ÷ PKB (sama getDesaPerPkbRatio). */
  rasioPkbDesa: number;
  /** true jika rasioPkbDesa > 2. */
  warningBeban: boolean;
};

export type PeringkatProvinsiPayload = {
  items: PeringkatProvinsiItem[];
  meta: RingkasanMeta;
};

export type RingkasanQuery = {
  tingkat: RingkasanTingkat;
  id?: string | null;
};
