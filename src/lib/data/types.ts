/** Kontrak respons API ringkasan & peringkat (fase 1). */

/** Sumber efektif payload, atau postgres-error pada respons 503. */
export type DataSource = "mock" | "postgres" | "postgres-error";

export type RingkasanTingkat = "nasional" | "provinsi" | "kabupaten";

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

/** Ranking kab/kota dalam satu provinsi (id = id_kabupaten). */
export type PeringkatKabupatenItem = {
  id: string;
  nama: string;
  tpk: number;
  pkb: number;
  desa: number;
  krs: number;
  /** SUM(jumlah_keluarga_sasaran) grain RT per id_kabupaten. */
  keluargaSasaran: number;
  rasio: number;
  rasioPkbDesa: number;
  warningBeban: boolean;
  /** Indikator DWH per kab — RTLH null/0 (kolom tidak ada). */
  indikator: IndikatorRingkasan;
};

export type PeringkatKabupatenPayload = {
  provinsiId: string;
  items: PeringkatKabupatenItem[];
  meta: RingkasanMeta;
};

export type RingkasanQuery = {
  tingkat: RingkasanTingkat;
  id?: string | null;
};

/** Query daftar TPK paging — filter wilayah wajib (hindari full scan). */
export type TpkListQuery = {
  provinsiId: number | null;
  kabupatenId: number | null;
  /** Cari NamaTPK (opsional). */
  q: string | null;
  page: number;
  pageSize: number;
};

export type TpkListItem = {
  tpkId: string;
  nama: string | null;
  nomorRegister: string | null;
  kodeTpk: string | null;
  alamat: string | null;
  provinsiId: number | null;
  kabupatenId: number | null;
  kecamatanId: number | null;
  kelurahanId: number | null;
  namaKabupaten: string | null;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
  jumlahAnggota: number;
  status: number | null;
};

export type TpkListPayload = {
  items: TpkListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    provinsiId: number | null;
    kabupatenId: number | null;
    q: string | null;
  };
  meta: RingkasanMeta;
};
