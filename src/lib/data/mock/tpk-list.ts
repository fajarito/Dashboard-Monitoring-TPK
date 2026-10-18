import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type { TpkListItem, TpkListPayload, TpkListQuery } from "@/lib/data/types";
import {
  getKabupatenApiId,
  KABUPATEN_ID_BY_SLUG,
} from "@/lib/kabupaten-api-id";
import {
  PROVINSI_ID_BY_SLUG,
  resolveProvinceFromRingkasanId,
} from "@/lib/province-api-id";
import { getTpkForScope, type TpkUnit } from "@/lib/tpk-drilldown-data";

function slugForProvinsiId(provinsiId: number | null): string | null {
  if (provinsiId == null) return null;
  const entry = Object.entries(PROVINSI_ID_BY_SLUG).find(
    ([, id]) => id === provinsiId,
  );
  return entry?.[0] ?? null;
}

function slugForKabupatenId(kabupatenId: number | null): string | null {
  if (kabupatenId == null) return null;
  const entry = Object.entries(KABUPATEN_ID_BY_SLUG).find(
    ([, id]) => id === kabupatenId,
  );
  return entry?.[0] ?? null;
}

function toItem(tpk: TpkUnit, provinceApiId: number | null): TpkListItem {
  const kabApi = tpk.kabupatenId
    ? Number.parseInt(getKabupatenApiId(tpk.kabupatenId) ?? "", 10)
    : null;
  return {
    tpkId: tpk.id,
    nama: tpk.name,
    nomorRegister: tpk.code?.slice(-3) ?? null,
    kodeTpk: null,
    alamat: null,
    provinsiId: provinceApiId,
    kabupatenId: Number.isFinite(kabApi) ? kabApi : null,
    kecamatanId: null,
    kelurahanId: null,
    namaKabupaten: tpk.kabupaten,
    namaKecamatan: tpk.kecamatan,
    namaKelurahan: tpk.desa,
    jumlahAnggota: tpk.members.length,
    status: tpk.status === "Aktif" ? 1 : 0,
  };
}

/** Adapter mock paging — sumber sama hierarki drill-down simulasi. */
export function getTpkListMock(query: TpkListQuery): TpkListPayload {
  let provinceSlug =
    slugForProvinsiId(query.provinsiId) ??
    (query.provinsiId != null
      ? resolveProvinceFromRingkasanId(String(query.provinsiId))?.id
      : null) ??
    "jabar";

  const kabSlug = slugForKabupatenId(query.kabupatenId);

  // Jika hanya kabupaten (mis. 166) tanpa provinsi → jabar.
  if (query.kabupatenId != null && query.provinsiId == null) {
    provinceSlug = kabSlug === "kab-sleman" ? "diy" : "jabar";
  }

  const province = resolveProvinceFromRingkasanId(provinceSlug);
  const provinceApiId = province
    ? PROVINSI_ID_BY_SLUG[province.id] ?? query.provinsiId
    : query.provinsiId;

  let list = getTpkForScope({
    provinceId: provinceSlug,
    kabupatenId: kabSlug ?? undefined,
  });

  const q = query.q?.trim().toLowerCase();
  if (q) {
    list = list.filter((tpk) => {
      const hay =
        `${tpk.name} ${tpk.desa} ${tpk.kecamatan} ${tpk.kabupaten}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const total = list.length;
  const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;
  const start = (query.page - 1) * query.pageSize;
  const pageItems = list
    .slice(start, start + query.pageSize)
    .map((tpk) => toItem(tpk, provinceApiId ?? null));

  return {
    items: pageItems,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      provinsiId: query.provinsiId ?? provinceApiId ?? null,
      kabupatenId: query.kabupatenId,
      q: query.q?.trim() || null,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "mock",
      generatedAt: new Date().toISOString(),
    },
  };
}
