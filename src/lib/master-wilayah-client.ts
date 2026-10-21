/**
 * Client ringan ke Master Wilayah REST (Kemendagri codes).
 * Dipakai untuk cocokkan baris peringkat (id internal + nama) → kode poligon SDK.
 * Tidak menyentuh Postgres / tidak menambah beban home overview.
 */

import { normalizeWilayahNama } from "@/lib/map-choropleth";

function resolveApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_MASTER_WILAYAH_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export type MwChild = { code: string; name: string };

type MwListResponse = {
  success?: boolean;
  data?: Array<{ code?: string; id?: string; name?: string }>;
  meta?: { totalPages?: number; hasNextPage?: boolean; page?: number };
};

function normalizeNama(value: string): string {
  return normalizeWilayahNama(value);
}

const cache = new Map<string, { at: number; items: MwChild[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "force-cache",
  });
  if (!res.ok) {
    throw new Error(`Master Wilayah HTTP ${res.status} (${url})`);
  }
  return (await res.json()) as T;
}

async function fetchAllPages(path: string): Promise<MwChild[]> {
  const base = resolveApiBase();
  if (!base) return [];

  const cacheKey = path;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;

  const items: MwChild[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= 40) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${base}/api/v1${path}${sep}limit=100&page=${page}`;
    const body = await fetchJson<MwListResponse>(url);
    const rows = body.data ?? [];
    for (const row of rows) {
      const code = String(row.code || row.id || "").replace(/\./g, "").trim();
      const name = String(row.name || "").trim();
      if (code && name) items.push({ code, name });
    }
    hasNext = Boolean(body.meta?.hasNextPage);
    page += 1;
    if (rows.length === 0) break;
  }

  cache.set(cacheKey, { at: Date.now(), items });
  return items;
}

export async function listMwRegencies(provinceCode: string): Promise<MwChild[]> {
  const code = provinceCode.replace(/\D/g, "").padStart(2, "0").slice(-2);
  return fetchAllPages(`/provinces/${code}/regencies`);
}

export async function listMwDistricts(regencyCode: string): Promise<MwChild[]> {
  const code = regencyCode.replace(/\D/g, "");
  return fetchAllPages(`/regencies/${code}/districts`);
}

export async function listMwVillages(districtCode: string): Promise<MwChild[]> {
  const code = districtCode.replace(/\D/g, "");
  return fetchAllPages(`/districts/${code}/villages`);
}

export function matchCodesByName(
  rows: Array<{ id: string; nama: string }>,
  mwChildren: MwChild[],
): Map<string, string> {
  const byNorm = new Map<string, string>();
  for (const child of mwChildren) {
    const key = normalizeNama(child.name);
    if (key && !byNorm.has(key)) byNorm.set(key, child.code);
  }

  const out = new Map<string, string>();
  for (const row of rows) {
    const key = normalizeNama(row.nama);
    if (!key) continue;
    let code = byNorm.get(key);
    if (!code) {
      // partial: "depok" ⊆ "kota depok" / sebaliknya
      for (const [mwKey, mwCode] of byNorm) {
        if (mwKey.includes(key) || key.includes(mwKey)) {
          code = mwCode;
          break;
        }
      }
    }
    if (code) out.set(row.id, code);
  }
  return out;
}

export async function resolveMwCodeByName(
  level: "regency" | "district" | "village",
  parentCode: string,
  nama: string,
): Promise<string | null> {
  const children =
    level === "regency"
      ? await listMwRegencies(parentCode)
      : level === "district"
        ? await listMwDistricts(parentCode)
        : await listMwVillages(parentCode);
  const map = matchCodesByName([{ id: "x", nama }], children);
  return map.get("x") ?? null;
}

export function getMasterWilayahApiBase(): string | null {
  return resolveApiBase();
}
