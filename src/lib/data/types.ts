/** Kontrak respons API ringkasan & peringkat (fase 1). */

/** Sumber efektif payload, atau postgres-error pada respons 503. */
export type DataSource = "mock" | "postgres" | "postgres-error";

export type RingkasanTingkat =
  | "nasional"
  | "provinsi"
  | "kabupaten"
  | "kecamatan"
  | "kelurahan";

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

/** Ranking kecamatan dalam satu kabupaten (id = id_kecamatan). */
export type PeringkatKecamatanItem = {
  id: string;
  nama: string;
  tpk: number;
  pkb: number;
  desa: number;
  krs: number;
  keluargaSasaran: number;
  rasio: number;
  rasioPkbDesa: number;
  warningBeban: boolean;
  indikator: IndikatorRingkasan;
};

export type PeringkatKecamatanPayload = {
  kabupatenId: string;
  items: PeringkatKecamatanItem[];
  meta: RingkasanMeta;
};

/** Ranking desa/kelurahan dalam satu kecamatan (id = id_kelurahan). */
export type PeringkatKelurahanItem = {
  id: string;
  nama: string;
  tpk: number;
  pkb: number;
  desa: number;
  krs: number;
  keluargaSasaran: number;
  rasio: number;
  rasioPkbDesa: number;
  warningBeban: boolean;
  indikator: IndikatorRingkasan;
};

export type PeringkatKelurahanPayload = {
  kecamatanId: string;
  items: PeringkatKelurahanItem[];
  meta: RingkasanMeta;
};

export type RingkasanQuery = {
  tingkat: RingkasanTingkat;
  id?: string | null;
};

/** Urutan daftar TPK — metrik dari rollup kelurahan (by_rekap), bukan by_name. */
export type TpkListSort =
  | "nama"
  | "krs-desc"
  | "krs-asc"
  | "ibuHamil-desc"
  | "baduta-desc"
  | "balita-desc"
  | "rtlh-desc";

/** Query daftar TPK paging — filter wilayah wajib (hindari full scan). */
export type TpkListQuery = {
  provinsiId: number | null;
  kabupatenId: number | null;
  kecamatanId: number | null;
  kelurahanId: number | null;
  /**
   * Cari dalam scope: desa/kelurahan, NomorRegister, nama anggota, nama PKB.
   * Min 2 karakter di UI; server mengabaikan string kosong.
   * Urutan hasil saat q aktif: exact register → prefix desa → partial.
   */
  q: string | null;
  page: number;
  pageSize: number;
  /** Default krs-desc bila data indikator ada; mock/postgres sama. */
  sort: TpkListSort;
};

/** PKB/PLKB aktif untuk desa TPK (via dat_KelurahanDesaBinaan). */
export type TpkListPkb = {
  pkbId: string;
  nama: string | null;
  /** 1 → PKB, 2 → PLKB (JabatanPKBAtauPLKBID). */
  jabatan: "PKB" | "PLKB" | null;
  /**
   * Jenjang detail (huruf JabatanPKBID / JabatanBPLKBID) bila ada.
   * Label resmi Terampil/Mahir/… belum dikunci → boleh kode huruf mentah.
   */
  jabatanDetail: string | null;
  nik: string | null;
  noHp: string | null;
};

/**
 * Indikator kelurahan dari SUM(by_rekap) grain RT → id_kelurahan.
 * null = join miss / DWH belum siap → UI tampilkan "—".
 * rtlh selalu null (kolom tidak ada di DWH).
 */
export type TpkListIndikator = {
  bumil: number | null;
  baduta: number | null;
  balita: number | null;
  jambanTL: number | null;
  airTL: number | null;
  rtlh: null;
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
  /**
   * Sampai 3 nama anggota (StatusTPK 1→2→3 prefer) untuk membedakan
   * beberapa TPK di desa yang sama. Kosong bila tidak ada baris.
   */
  anggota: string[];
  /**
   * Jumlah TPK (DISTINCT TPKID) se-kelurahan dalam filter scope saat ini.
   * Dipakai caption `Agregat desa · N TPK` bila N > 1 — metrik KRS/sasaran
   * adalah rollup kelurahan, bukan milikan eksklusif satu baris.
   */
  tpkSeDesa: number;
  status: number | null;
  /** SUM(jumlah_keluarga_sasaran) di kelurahan TPK. */
  keluargaSasaran: number | null;
  /** SUM(total_prioritas) = KRS di kelurahan TPK. */
  krs: number | null;
  indikator: TpkListIndikator;
  /**
   * PKB/PLKB binaan desa (Status=1). null jika tidak ada join.
   * Jika >1 PKB aktif per desa: pilih TRIM(PKBID) terkecil (dokumentasi di adapter).
   */
  pkb: TpkListPkb | null;
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
    kecamatanId: number | null;
    kelurahanId: number | null;
    q: string | null;
  };
  meta: RingkasanMeta;
};

/** Anggota satu TPK (detail) — dari dat_AnggotaTPK. */
export type TpkDetailAnggota = {
  nomorUrut: number | null;
  nama: string;
  nik: string | null;
  noHp: string | null;
  statusTpk: number | null;
  /** Label peran (statustpk_tbl atau kamus 1/2/3). */
  peran: string;
  /** Label pelatihan / orientasi bila ada. */
  pelatihanLabel: string | null;
  /** true bila BelumDilatih≠1 dan ada sinyal pelatihan. */
  terlatih: boolean;
};

/**
 * Komposisi prioritas grain kelurahan (SUM by_rekap).
 * null jika DWH miss — donut UI kosong/jujur.
 */
export type TpkDetailKomposisiPrioritas = {
  prioritas1: number;
  prioritas2: number;
  prioritas3: number;
  prioritas4: number;
  bukan: number;
  tidakRisiko: number;
};

/**
 * Detail satu TPK — identitas + anggota + PKB desa + agregat kelurahan.
 * Tidak memuat daftar keluarga by_name (deferred).
 */
export type TpkDetailPayload = {
  tpkId: string;
  /** Nama tampilan `TPK (Desa) - Register` (atau fallback). */
  nama: string;
  nomorRegister: string | null;
  kodeTpk: string | null;
  alamat: string | null;
  status: number | null;
  /** Label UI: Aktif / Nonaktif. */
  statusLabel: string;
  wilayah: {
    provinsiId: number | null;
    kabupatenId: number | null;
    kecamatanId: number | null;
    kelurahanId: number | null;
    namaProvinsi: string | null;
    namaKabupaten: string | null;
    namaKecamatan: string | null;
    namaKelurahan: string | null;
  };
  anggota: TpkDetailAnggota[];
  /** PKB/PLKB binaan desa (Status=1); null jika tidak ada. */
  pkb: TpkListPkb | null;
  /** SUM(jumlah_keluarga_sasaran) kelurahan TPK. */
  keluargaSasaran: number | null;
  /** SUM(total_prioritas) = KRS kelurahan TPK. */
  krs: number | null;
  indikator: TpkListIndikator;
  /**
   * Jumlah TPK aktif se-kelurahan — caption agregat desa bila > 1.
   */
  tpkSeDesa: number;
  komposisiPrioritas: TpkDetailKomposisiPrioritas | null;
  /**
   * Stub daftar keluarga — selalu [] di fase ini (by_name deferred).
   * UI menampilkan empty jujur, bukan mock keluarga.
   */
  keluarga: [];
  meta: RingkasanMeta;
};
