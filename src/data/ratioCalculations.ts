export type ValidationIssue = {
  type: "missing-id" | "invalid-value" | "conflicting-tpk-family-count" | "conflicting-village-krs" | "region-mapping-conflict" | "coverage-not-validated"
  recordId?: string
  message: string
}

export type TpkDetailRatioRow = {
  tpkId: string
  regionCode: string
  assignedFamilyCount: number
}

export type VillageKrsRatioRow = {
  villageCode: string
  regionCode: string
  totalPrioritas: number
}

export type ValidatedAggregate = {
  total: number
  validRecordCount: number
  issues: ValidationIssue[]
  status: "valid" | "invalid"
}

const isValidCount = (value: number) =>
  Number.isFinite(value) && Number.isInteger(value) && value >= 0

export function aggregateAssignedFamiliesByUniqueTpk(
  rows: TpkDetailRatioRow[],
): ValidatedAggregate {
  const grouped = new Map<string, {
    values: Set<number>
    regionCodes: Set<string>
  }>()
  const issues: ValidationIssue[] = []

  rows.forEach((row) => {
    const tpkId = row.tpkId.trim()
    if (!tpkId) {
      issues.push({
        type: "missing-id",
        message: "Baris tpk_detail tidak memiliki TPKID.",
      })
      return
    }
    if (!isValidCount(row.assignedFamilyCount)) {
      issues.push({
        type: "invalid-value",
        recordId: tpkId,
        message:
          "jml_keluarga_sasaran harus berupa bilangan bulat non-negatif.",
      })
      return
    }
    const current = grouped.get(tpkId) ?? {
      values: new Set<number>(),
      regionCodes: new Set<string>(),
    }
    current.values.add(row.assignedFamilyCount)
    current.regionCodes.add(row.regionCode.trim())
    grouped.set(tpkId, current)
  })

  let total = 0
  let validRecordCount = 0
  grouped.forEach((group, tpkId) => {
    if (group.values.size !== 1) {
      issues.push({
        type: "conflicting-tpk-family-count",
        recordId: tpkId,
        message:
          "TPKID memiliki lebih dari satu nilai jml_keluarga_sasaran dan dikeluarkan dari agregasi.",
      })
      return
    }
    if (group.regionCodes.size !== 1 || group.regionCodes.has("")) {
      issues.push({
        type: "region-mapping-conflict",
        recordId: tpkId,
        message:
          "TPKID memiliki kode wilayah kosong atau tidak konsisten dan dikeluarkan dari agregasi.",
      })
      return
    }
    total += [...group.values][0]
    validRecordCount += 1
  })

  return {
    total,
    validRecordCount,
    issues,
    status: issues.length === 0 ? "valid" : "invalid",
  }
}

export function aggregateKrsByUniqueVillage(
  rows: VillageKrsRatioRow[],
): ValidatedAggregate {
  const grouped = new Map<string, {
    values: Set<number>
    regionCodes: Set<string>
  }>()
  const issues: ValidationIssue[] = []

  rows.forEach((row) => {
    const villageCode = row.villageCode.trim()
    if (!villageCode) {
      issues.push({
        type: "missing-id",
        message: "Baris agg_all tidak memiliki kode desa/kelurahan.",
      })
      return
    }
    if (!isValidCount(row.totalPrioritas)) {
      issues.push({
        type: "invalid-value",
        recordId: villageCode,
        message: "total_prioritas harus berupa bilangan bulat non-negatif.",
      })
      return
    }
    const current = grouped.get(villageCode) ?? {
      values: new Set<number>(),
      regionCodes: new Set<string>(),
    }
    current.values.add(row.totalPrioritas)
    current.regionCodes.add(row.regionCode.trim())
    grouped.set(villageCode, current)
  })

  let total = 0
  let validRecordCount = 0
  grouped.forEach((group, villageCode) => {
    if (group.values.size !== 1) {
      issues.push({
        type: "conflicting-village-krs",
        recordId: villageCode,
        message:
          "Kode desa memiliki lebih dari satu total_prioritas dan dikeluarkan dari agregasi.",
      })
      return
    }
    if (group.regionCodes.size !== 1 || group.regionCodes.has("")) {
      issues.push({
        type: "region-mapping-conflict",
        recordId: villageCode,
        message:
          "Kode desa memiliki pemetaan wilayah kosong atau tidak konsisten dan dikeluarkan dari agregasi.",
      })
      return
    }
    total += [...group.values][0]
    validRecordCount += 1
  })

  return {
    total,
    validRecordCount,
    issues,
    status: issues.length === 0 ? "valid" : "invalid",
  }
}

export function calculateFamiliesPerTpk(
  numerator: ValidatedAggregate,
  validTpkCount: number,
  denominatorCoverageValidated: boolean,
) {
  if (
    numerator.status !== "valid" ||
    !isValidCount(validTpkCount) ||
    validTpkCount === 0 ||
    !denominatorCoverageValidated
  ) {
    return {
      status: "invalid" as const,
      value: null,
      label: "Perlu validasi",
    }
  }
  const value = numerator.total / validTpkCount
  return {
    status: "valid" as const,
    value,
    label: `1 TPK : ${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1,
    }).format(value)} keluarga`,
  }
}
