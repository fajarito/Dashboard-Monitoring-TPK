import bogorKecamatanStagingJson from "./bogorKecamatanStaging.json"
import jawaBarat01Json from "./jawaBarat01.json"
import jawaBarat01CrosswalkJson from "./jawaBarat01Crosswalk.json"
import jawaBarat02Json from "./jawaBarat02.json"
import jawaBarat03Json from "./jawaBarat03.json"
import jawaBarat04Json from "./jawaBarat04.json"
import jawaBarat05Json from "./jawaBarat05.json"
import jawaBarat06Json from "./jawaBarat06.json"
import jawaBarat07Json from "./jawaBarat07.json"
import jawaBarat08Json from "./jawaBarat08.json"
import tpkDashboardStagingJson from "./tpkDashboardStaging.json"
import type { RegionLevel } from "./indicatorSchema"

export type StagingRegionRecord = {
  id: string
  level: string
  nama: string
  hierarki_nama: string[]
  hierarki_kode: string[]
  jumlah_tpk_agregat_sementara: number
  jumlah_tpkid_teramati_sementara: number
  keluarga_sasaran_tercatat: number | null
  keluarga_berisiko_stunting_total_prioritas: number | null
  rasio_sasaran_per_tpk: number | null
  rasio_krs_per_tpk: number | null
  status: "PERLU_VALIDASI"
  catatan: string
  reference_bps_code?: string
}

const previewData = tpkDashboardStagingJson as unknown as {
  metadata: {
    versi: string
    status: string
    cakupan: string
    sumber: string[]
    keterangan: string
  }
  wilayah: StagingRegionRecord[]
}

const bogorKecamatanData = bogorKecamatanStagingJson as unknown as {
  metadata: {
    source: string
    status: string
    record_count: number
  }
  wilayah: StagingRegionRecord[]
}

export type CoverageRecord = {
  level: 3 | 4
  name: string
  path: string[]
  id: string
  parentId: string
  tpkCount: number
  anggotaBaris: number
  anggotaTanpaTPKID: number
  pkbNipUnik: number
  aggPembandingTPK: number
  keluargaSasaran: number
  krs: number
  rasioSasaranPerTPK: null
  rasioKrsPerTPK: null
  status: "PERLU_VALIDASI_NUMERATOR"
  cakupan: "HANYA_ACEH_DAN_JAWA_BARAT"
  quality: {
    dataCapaian: boolean
    dataTPK: boolean
    tpkCountVsAggBerbeda: boolean
  }
}

type JawaBaratChunk = {
  province: "JAWA BARAT"
  records: CoverageRecord[]
}

const jawaBaratChunks = [
  jawaBarat01Json,
  jawaBarat02Json,
  jawaBarat03Json,
  jawaBarat04Json,
  jawaBarat05Json,
  jawaBarat06Json,
  jawaBarat07Json,
  jawaBarat08Json,
] as unknown as JawaBaratChunk[]

const jawaBaratRecordsById = new Map(
  jawaBaratChunks.flatMap((chunk) =>
    chunk.records.map((record) => [record.id, record] as const),
  ),
)

const jawaBarat01Crosswalk = jawaBarat01CrosswalkJson as unknown as {
  source: string
  records: Array<{
    reference_bps_code: string
    record_id: string
    parent_id: string
  }>
}

export function getJawaBaratRecordById(recordId: string) {
  const record = jawaBaratRecordsById.get(recordId)
  if (
    !record ||
    record.id !== record.path.join("|") ||
    record.parentId !== record.path.slice(0, -1).join("|")
  ) {
    return null
  }
  return record
}

export function getJawaBaratRecordByBpsCode(referenceBpsCode: string) {
  const crosswalk = jawaBarat01Crosswalk.records.find(
    (record) => record.reference_bps_code === referenceBpsCode,
  )
  if (!crosswalk) return null
  const record = getJawaBaratRecordById(crosswalk.record_id)
  if (!record || record.parentId !== crosswalk.parent_id) {
    return null
  }
  return record
}

export type StagingScopeInput = {
  level: RegionLevel
  stagingRegionId?: string
  referenceBpsCode?: string
}

export function getStagingRegionRecord({
  level,
  stagingRegionId,
  referenceBpsCode,
}: StagingScopeInput) {
  if (level === "nasional") return null
  if (level === "kecamatan" && referenceBpsCode) {
    return (
      bogorKecamatanData.wilayah.find(
        (record) => record.reference_bps_code === referenceBpsCode,
      ) ?? null
    )
  }
  if (!stagingRegionId) return null
  return (
    previewData.wilayah.find((record) => record.id === stagingRegionId) ?? null
  )
}

export function getStagingRatioContext(input: StagingScopeInput) {
  const coverageRecord =
    input.level === "kecamatan" && input.referenceBpsCode
      ? getJawaBaratRecordByBpsCode(input.referenceBpsCode)
      : null
  const record = coverageRecord ?? getStagingRegionRecord(input)
  return {
    record,
    coverageRecord,
    stagingLoaded: true,
    ratioStatus: coverageRecord?.status ?? "PERLU_VALIDASI" as const,
    coverage:
      input.level === "nasional"
        ? previewData.metadata.cakupan
        : coverageRecord
          ? "Tersedia pada delapan chunk parsial Jawa Barat"
          : record
            ? "Wilayah tersedia pada data staging"
            : "Wilayah tidak tersedia pada data staging",
    metadata: previewData.metadata,
  }
}
