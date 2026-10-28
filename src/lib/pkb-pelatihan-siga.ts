/**
 * Kamus flag pelatihan `sigabaru.dat_PKB` (SIGA).
 * Nilai 1 = sudah mengikuti jenis pelatihan itu.
 * Kolom `*BelumTerlatih` = 1 berarti belum terlatih di kelompok tersebut
 * (bukan item daftar positif).
 */

export type PkbPelatihanSigaFlags = {
  pelatihanFungsionalLdu: number | null;
  pelatihanFungsionalRefreshing: number | null;
  pelatihanFungsionalPenjenjangan: number | null;
  pelatihanFungsionalBelumTerlatih: number | null;
  pelatihanTeknisPencatatanLaporan: number | null;
  pelatihanTeknisKipKonseling: number | null;
  pelatihanTeknisAdvokasi: number | null;
  pelatihanTeknisKie: number | null;
  pelatihanTeknisSubstansiLainnya: number | null;
  pelatihanTeknisKependudukan: number | null;
  pelatihanTeknisPembangunanKeluarga: number | null;
  pelatihanTeknisBelumTerlatih: number | null;
};

export type PkbPelatihanSqlRow = {
  pelatihan_fungsional_ldu: number | null;
  pelatihan_fungsional_refreshing: number | null;
  pelatihan_fungsional_penjenjangan: number | null;
  pelatihan_fungsional_belum_terlatih: number | null;
  pelatihan_teknis_pencatatan_laporan: number | null;
  pelatihan_teknis_kip_konseling: number | null;
  pelatihan_teknis_advokasi: number | null;
  pelatihan_teknis_kie: number | null;
  pelatihan_teknis_substansi_lainnya: number | null;
  pelatihan_teknis_kependudukan: number | null;
  pelatihan_teknis_pembangunan_keluarga: number | null;
  pelatihan_teknis_belum_terlatih: number | null;
};

const POSITIVE_LABELS: Array<{
  key: keyof PkbPelatihanSigaFlags;
  label: string;
}> = [
  { key: "pelatihanFungsionalLdu", label: "Fungsional LDU" },
  { key: "pelatihanFungsionalRefreshing", label: "Fungsional Refreshing" },
  {
    key: "pelatihanFungsionalPenjenjangan",
    label: "Fungsional Penjenjangan",
  },
  {
    key: "pelatihanTeknisPencatatanLaporan",
    label: "Teknis Pencatatan & Laporan",
  },
  { key: "pelatihanTeknisKipKonseling", label: "Teknis KIP / Konseling" },
  { key: "pelatihanTeknisAdvokasi", label: "Teknis Advokasi" },
  { key: "pelatihanTeknisKie", label: "Teknis KIE" },
  {
    key: "pelatihanTeknisSubstansiLainnya",
    label: "Teknis Substansi Lainnya",
  },
  { key: "pelatihanTeknisKependudukan", label: "Teknis Kependudukan" },
  {
    key: "pelatihanTeknisPembangunanKeluarga",
    label: "Teknis Pembangunan Keluarga",
  },
];

function flagOn(value: number | null | undefined): boolean {
  return value === 1;
}

export function mapPkbPelatihanSqlRow(
  row: Partial<PkbPelatihanSqlRow> | null | undefined,
): PkbPelatihanSigaFlags {
  return {
    pelatihanFungsionalLdu: row?.pelatihan_fungsional_ldu ?? null,
    pelatihanFungsionalRefreshing:
      row?.pelatihan_fungsional_refreshing ?? null,
    pelatihanFungsionalPenjenjangan:
      row?.pelatihan_fungsional_penjenjangan ?? null,
    pelatihanFungsionalBelumTerlatih:
      row?.pelatihan_fungsional_belum_terlatih ?? null,
    pelatihanTeknisPencatatanLaporan:
      row?.pelatihan_teknis_pencatatan_laporan ?? null,
    pelatihanTeknisKipKonseling: row?.pelatihan_teknis_kip_konseling ?? null,
    pelatihanTeknisAdvokasi: row?.pelatihan_teknis_advokasi ?? null,
    pelatihanTeknisKie: row?.pelatihan_teknis_kie ?? null,
    pelatihanTeknisSubstansiLainnya:
      row?.pelatihan_teknis_substansi_lainnya ?? null,
    pelatihanTeknisKependudukan: row?.pelatihan_teknis_kependudukan ?? null,
    pelatihanTeknisPembangunanKeluarga:
      row?.pelatihan_teknis_pembangunan_keluarga ?? null,
    pelatihanTeknisBelumTerlatih: row?.pelatihan_teknis_belum_terlatih ?? null,
  };
}

/**
 * Daftar jenis pelatihan yang sudah diikuti (flag = 1).
 * Tidak memakai portal / jabatanDetail.
 */
export function resolvePkbPelatihanLabels(
  flags: PkbPelatihanSigaFlags | null | undefined,
): string[] {
  if (!flags) return [];
  const labels: string[] = [];
  for (const item of POSITIVE_LABELS) {
    if (flagOn(flags[item.key])) labels.push(item.label);
  }
  return labels;
}

/** Ringkas status bila tidak ada flag positif. */
export function resolvePkbPelatihanEmptyHint(
  flags: PkbPelatihanSigaFlags | null | undefined,
): string {
  if (!flags) return "Belum ada data pelatihan dari SIGA.";
  const belumFungsi = flagOn(flags.pelatihanFungsionalBelumTerlatih);
  const belumTeknis = flagOn(flags.pelatihanTeknisBelumTerlatih);
  if (belumFungsi && belumTeknis) {
    return "Belum terlatih fungsional & teknis (SIGA).";
  }
  if (belumFungsi) return "Belum terlatih fungsional (SIGA).";
  if (belumTeknis) return "Belum terlatih teknis (SIGA).";
  return "Belum ada data pelatihan dari SIGA.";
}
