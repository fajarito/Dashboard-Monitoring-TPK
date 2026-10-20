/**
 * Resolve label UI untuk halaman wilayah (title, breadcrumb, scopeLabel).
 * Prefer nama dari hierarki mock / v_* / peringkat — jangan tampilkan ID mentah.
 */

import {
  fetchPeringkatKabupaten,
  fetchPeringkatKecamatan,
} from "@/lib/data";
import {
  lookupNamaKabupatenById,
  lookupNamaKecamatanById,
} from "@/lib/data/postgres/wilayah-nama";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getKecamatanApiId } from "@/lib/kecamatan-api-id";
import {
  kabNameFallback,
  kecNameFallback,
  isUnresolvedKabName,
  isUnresolvedKecName,
} from "@/lib/wilayah-name-labels";
import {
  getKabupatenById,
  getKecamatanById,
} from "@/lib/wilayah-hierarchy-data";

export {
  kabNameFallback,
  kecNameFallback,
  kelNameFallback,
  isUnresolvedKabName,
  isUnresolvedKecName,
} from "@/lib/wilayah-name-labels";

/**
 * Nama kabupaten/kota untuk header halaman.
 * Urutan: hierarki mock (slug) → v_kabupaten → peringkat kab → fallback ID.
 */
export async function resolveKabupatenDisplayName(args: {
  provinceId: string;
  kabId: string;
  provinsiApiId: string;
}): Promise<string> {
  const { provinceId, kabId, provinsiApiId } = args;
  const kab = getKabupatenById(provinceId, kabId);
  const apiId =
    getKabupatenApiId(kab?.id ?? kabId) ??
    getKabupatenApiId(kabId) ??
    kabId.trim();

  if (kab?.name && !isUnresolvedKabName(kab.name, apiId)) {
    return kab.name;
  }

  const fromView = await lookupNamaKabupatenById(apiId);
  if (fromView) return fromView;

  try {
    const peringkat = await fetchPeringkatKabupaten(provinsiApiId);
    const hit = peringkat.items.find(
      (item) => item.id === apiId || item.id === String(Number(apiId)),
    );
    const nama = hit?.nama?.trim();
    if (nama && !isUnresolvedKabName(nama, apiId)) return nama;
  } catch {
    // ignore — pakai fallback
  }

  return kabNameFallback(apiId);
}

/**
 * Nama kecamatan untuk header halaman.
 * Urutan: hierarki mock → v_kecamatan → peringkat kec → fallback ID.
 */
export async function resolveKecamatanDisplayName(args: {
  provinceId: string;
  kabId: string;
  kecId: string;
  kabupatenApiId: string;
}): Promise<string> {
  const { provinceId, kabId, kecId, kabupatenApiId } = args;
  const kec = getKecamatanById(provinceId, kabId, kecId);
  const apiId =
    getKecamatanApiId(kec?.id ?? kecId) ??
    getKecamatanApiId(kecId) ??
    kecId.trim();

  if (kec?.name && !isUnresolvedKecName(kec.name, apiId)) {
    return kec.name;
  }

  const fromView = await lookupNamaKecamatanById(apiId);
  if (fromView) return fromView;

  try {
    const peringkat = await fetchPeringkatKecamatan(kabupatenApiId);
    const hit = peringkat.items.find(
      (item) => item.id === apiId || item.id === String(Number(apiId)),
    );
    const nama = hit?.nama?.trim();
    if (nama && !isUnresolvedKecName(nama, apiId)) return nama;
  } catch {
    // ignore
  }

  return kecNameFallback(apiId);
}
