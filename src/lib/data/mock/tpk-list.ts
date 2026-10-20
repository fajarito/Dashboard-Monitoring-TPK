import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import type {
  TpkListIndikator,
  TpkListItem,
  TpkListPayload,
  TpkListPkb,
  TpkListQuery,
  TpkListSort,
} from "@/lib/data/types";
import {
  getKabupatenApiId,
  KABUPATEN_ID_BY_SLUG,
} from "@/lib/kabupaten-api-id";
import {
  getKecamatanApiId,
  getKecamatanSlugByApiId,
  KECAMATAN_ID_BY_SLUG,
} from "@/lib/kecamatan-api-id";
import {
  PROVINSI_ID_BY_SLUG,
  resolveProvinceFromRingkasanId,
} from "@/lib/province-api-id";
import { dedupeByTpkId } from "@/lib/tpk-display-name";
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

function slugForKecamatanId(kecamatanId: number | null): string | null {
  if (kecamatanId == null) return null;
  return (
    getKecamatanSlugByApiId(kecamatanId) ??
    Object.entries(KECAMATAN_ID_BY_SLUG).find(
      ([, id]) => id === kecamatanId,
    )?.[0] ??
    null
  );
}

function emptyIndikator(): TpkListIndikator {
  return {
    bumil: null,
    baduta: null,
    balita: null,
    jambanTL: null,
    airTL: null,
    rtlh: null,
  };
}

function toPkb(tpk: TpkUnit): TpkListPkb {
  return {
    pkbId: tpk.pkb.nik || `mock-${tpk.id}`,
    nama: tpk.pkb.name,
    jabatan: tpk.pkb.jabatan,
    jabatanDetail: tpk.pkb.jabatanDetail,
    nik: tpk.pkb.nik,
    noHp: tpk.pkb.phone,
  };
}

function toItem(
  tpk: TpkUnit,
  provinceApiId: number | null,
  tpkSeDesa: number,
): TpkListItem {
  const kabApi = tpk.kabupatenId
    ? Number.parseInt(getKabupatenApiId(tpk.kabupatenId) ?? "", 10)
    : null;
  const desa = tpk.desa?.trim() || null;
  const anggota = tpk.members
    .map((m) => m.name.trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    tpkId: tpk.id,
    // Tampilkan TPK (desa/kelurahan), bukan nama palsu "TPK Sukamaju".
    nama: desa ? `TPK (${desa})` : null,
    nomorRegister: tpk.code?.slice(-3) ?? null,
    kodeTpk: null,
    alamat: null,
    provinsiId: provinceApiId,
    kabupatenId: Number.isFinite(kabApi) ? kabApi : null,
    kecamatanId: tpk.kecamatanId
      ? Number.parseInt(getKecamatanApiId(tpk.kecamatanId) ?? "", 10) || null
      : null,
    kelurahanId: null,
    namaKabupaten: tpk.kabupaten,
    namaKecamatan: tpk.kecamatan,
    namaKelurahan: desa,
    jumlahAnggota: tpk.members.length,
    anggota,
    tpkSeDesa,
    status: tpk.status === "Aktif" ? 1 : 0,
    keluargaSasaran: tpk.keluargaSasaran,
    krs: tpk.krs,
    indikator: {
      bumil: tpk.sasaran.ibuHamil,
      baduta: tpk.sasaran.baduta,
      balita: tpk.sasaran.balita,
      jambanTL: tpk.sasaran.jambanTidakLayak,
      airTL: tpk.sasaran.sumberAirTidakLayak,
      rtlh: null, // kolom DWH belum ada — jujur null juga di mock list API
    },
    pkb: toPkb(tpk),
  };
}

function metricValue(item: TpkListItem, sort: TpkListSort): number {
  switch (sort) {
    case "krs-desc":
    case "krs-asc":
      return item.krs ?? -1;
    case "ibuHamil-desc":
      return item.indikator.bumil ?? -1;
    case "baduta-desc":
      return item.indikator.baduta ?? -1;
    case "balita-desc":
      return item.indikator.balita ?? -1;
    case "rtlh-desc":
      return item.indikator.rtlh ?? -1;
    default:
      return 0;
  }
}

function sortItems(items: TpkListItem[], sort: TpkListSort): TpkListItem[] {
  const copy = items.slice();
  if (sort === "nama") {
    return copy.sort((a, b) =>
      (a.nama ?? a.tpkId).localeCompare(b.nama ?? b.tpkId, "id"),
    );
  }
  const asc = sort === "krs-asc";
  return copy.sort((a, b) => {
    const diff = metricValue(a, sort) - metricValue(b, sort);
    if (diff !== 0) return asc ? diff : -diff;
    return (a.nama ?? a.tpkId).localeCompare(b.nama ?? b.tpkId, "id");
  });
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
  const kecSlug = slugForKecamatanId(query.kecamatanId);

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
    kecamatanId: kecSlug ?? undefined,
  });

  if (query.kecamatanId != null && !kecSlug) {
    // id numerik tanpa slug mock → filter by resolved api id on mapped items later
    list = list.filter((tpk) => {
      const id = tpk.kecamatanId
        ? Number.parseInt(getKecamatanApiId(tpk.kecamatanId) ?? "", 10)
        : NaN;
      return id === query.kecamatanId;
    });
  }

  // Samakan ID sintetis dengan peringkat-kelurahan mock: kecApiId * 100 + index + 1
  if (query.kelurahanId != null) {
    const kecApi =
      query.kecamatanId ??
      (kecSlug
        ? Number.parseInt(getKecamatanApiId(kecSlug) ?? "", 10)
        : NaN);
    const desaOrder: string[] = [];
    const seen = new Set<string>();
    for (const tpk of list) {
      const nama = (tpk.desa?.trim() || tpk.name).toLowerCase();
      if (!seen.has(nama)) {
        seen.add(nama);
        desaOrder.push(nama);
      }
    }
    const targetNama = desaOrder.find((_, index) => {
      const base = Number.isFinite(kecApi) && kecApi > 0 ? kecApi : 0;
      const id = base * 100 + index + 1 || index + 1;
      return id === query.kelurahanId;
    });
    if (targetNama) {
      list = list.filter(
        (tpk) => (tpk.desa?.trim() || tpk.name).toLowerCase() === targetNama,
      );
    } else {
      list = [];
    }
  }

  const qRaw = query.q?.trim() || "";
  const q = qRaw.toLowerCase();
  if (q) {
    list = list.filter((tpk) => {
      const reg = (tpk.code?.slice(-3) ?? "").toLowerCase();
      const anggota = tpk.members.map((m) => m.name).join(" ").toLowerCase();
      const hay =
        `${tpk.name} ${tpk.desa} ${tpk.kecamatan} ${tpk.kabupaten} ${tpk.pkb.name} ${reg} ${anggota} ${tpk.code}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const seDesaCount = new Map<string, number>();
  for (const tpk of list) {
    const key = (tpk.desa?.trim() || tpk.id).toLowerCase();
    seDesaCount.set(key, (seDesaCount.get(key) ?? 0) + 1);
  }

  const mapped = dedupeByTpkId(
    list.map((tpk) => {
      const key = (tpk.desa?.trim() || tpk.id).toLowerCase();
      return toItem(tpk, provinceApiId ?? null, seDesaCount.get(key) ?? 1);
    }),
  );

  function relevanceRank(item: TpkListItem): number {
    if (!q) return 2;
    const reg = item.nomorRegister?.trim().toLowerCase() ?? "";
    if (reg && reg === q) return 0;
    const desa = item.namaKelurahan?.trim().toLowerCase() ?? "";
    if (desa.startsWith(q)) return 1;
    return 2;
  }

  const sorted = q
    ? mapped.slice().sort((a, b) => {
        const ra = relevanceRank(a);
        const rb = relevanceRank(b);
        if (ra !== rb) return ra - rb;
        if (query.sort === "nama") {
          return (a.nama ?? a.tpkId).localeCompare(b.nama ?? b.tpkId, "id");
        }
        const asc = query.sort === "krs-asc";
        const diff = metricValue(a, query.sort) - metricValue(b, query.sort);
        if (diff !== 0) return asc ? diff : -diff;
        return (a.nama ?? a.tpkId).localeCompare(b.nama ?? b.tpkId, "id");
      })
    : sortItems(mapped, query.sort);

  const total = sorted.length;
  const totalPages = total > 0 ? Math.ceil(total / query.pageSize) : 0;
  const start = (query.page - 1) * query.pageSize;
  const pageItems = sorted.slice(start, start + query.pageSize);

  return {
    items: pageItems,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages,
    filters: {
      provinsiId: query.provinsiId ?? provinceApiId ?? null,
      kabupatenId: query.kabupatenId,
      kecamatanId: query.kecamatanId,
      kelurahanId: query.kelurahanId,
      q: query.q?.trim() || null,
    },
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "mock",
      generatedAt: new Date().toISOString(),
    },
  };
}

/** Dipakai bila postgres partial fail — pastikan shape item lengkap. */
export function blankIndikatorFields(): Pick<
  TpkListItem,
  "keluargaSasaran" | "krs" | "indikator" | "pkb"
> {
  return {
    keluargaSasaran: null,
    krs: null,
    indikator: emptyIndikator(),
    pkb: null,
  };
}
