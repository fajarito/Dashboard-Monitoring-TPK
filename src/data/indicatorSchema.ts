export type RatioIndicatorDefinition = {
  key: "keluargaBerisikoStunting" | "keluargaSasaranPerTpk"
  label: string
  numeratorSource: string
  numeratorColumn: string
  numeratorRule: string
  denominatorSource: string
  denominatorColumn: string
  denominatorRule: string
  outputFormat: string
}

export const indicatorSchema: Record<RatioIndicatorDefinition["key"], RatioIndicatorDefinition> =
  {
    keluargaSasaranPerTpk: {
      key: "keluargaSasaranPerTpk",
      label: "Seluruh Sasaran per TPK",
      numeratorSource: "tpk_detail.xlsx",
      numeratorColumn: "jml_keluarga_sasaran",
      numeratorRule:
        "Ambil satu nilai per TPKID. Baris anggota dengan TPKID yang sama tidak dijumlahkan. Nilai berbeda pada TPKID yang sama harus ditandai sebagai konflik.",
      denominatorSource: "KPI TPK Dashboard",
      denominatorColumn: "COUNT DISTINCT TPKID",
      denominatorRule:
        "Gunakan nilai KPI TPK otoritatif pada kode wilayah, level, dan periode yang sama. Jangan gunakan jml_kelompok_tpk staging dan jangan memberi label aktif.",
      outputFormat: "1 TPK : N keluarga",
    },
    keluargaBerisikoStunting: {
      key: "keluargaBerisikoStunting",
      label: "KRS per TPK",
      numeratorSource: "agg_all.xlsx",
      numeratorColumn: "total_prioritas",
      numeratorRule:
        "Ambil total_prioritas satu kali per kode desa/kelurahan tervalidasi, lalu agregasikan mengikuti hierarki wilayah.xlsx.",
      denominatorSource: "KPI TPK Dashboard",
      denominatorColumn: "COUNT DISTINCT TPKID",
      denominatorRule:
        "Gunakan nilai KPI TPK otoritatif pada kode wilayah, level, dan periode yang sama. Jangan gunakan jml_kelompok_tpk staging dan jangan memberi label aktif.",
      outputFormat: "1 TPK : N keluarga",
    },
  }

export type RegionLevel = "nasional" | "provinsi" | "kabupaten-kota" | "kecamatan" | "desa-kelurahan"

export const normalizeRegionKey = (level: RegionLevel, code: string | number) =>
  `${level}:${String(code).trim()}`

export const ratioDataRequirements = {
  files: [
    "tpk_detail.xlsx",
    "agg_all.xlsx",
    "agg_pkb_kel_tpk.xlsx",
    "wilayah.xlsx",
  ],
  stagingLoaded: true,
  finalDatasetsLoaded: false,
  validationStatus: "needs-validation" as const,
}
