import {
  bogorSubdistricts,
  nationalMetrics,
  provinces,
  westJavaCities,
} from "./mockData"
import type { RegionLevel } from "./indicatorSchema"
import { getJawaBaratRecordByBpsCode } from "./tpkStagingAdapter"

export type AuthoritativeTpkScope = {
  level: RegionLevel
  regionId: string
  period: string
}

export type AuthoritativeTpkSelection = AuthoritativeTpkScope & {
  count: number | null
  source: "dashboard-kpi-distinct-tpkid"
  definition: "COUNT DISTINCT TPKID"
  validationStatus: "authoritative-dashboard-kpi" | "scope-not-available"
}

export function selectAuthoritativeTpkCount({
  level,
  regionId,
  period,
}: AuthoritativeTpkScope): AuthoritativeTpkSelection {
  let count: number | null = null

  if (level === "nasional" && regionId === "IDN") {
    count = nationalMetrics.tpk
  } else if (level === "provinsi") {
    count = provinces.find((province) => province.id === regionId)?.tpk ?? null
  } else if (level === "kabupaten-kota") {
    count = westJavaCities.find((city) => city.id === regionId)?.tpk ?? null
  } else if (level === "kecamatan") {
    count =
      getJawaBaratRecordByBpsCode(regionId)?.tpkCount ??
      bogorSubdistricts.find((subdistrict) => subdistrict.id === regionId)
        ?.tpk ??
      null
  }

  return {
    level,
    regionId,
    period,
    count,
    source: "dashboard-kpi-distinct-tpkid",
    definition: "COUNT DISTINCT TPKID",
    validationStatus:
      count === null ? "scope-not-available" : "authoritative-dashboard-kpi",
  }
}
