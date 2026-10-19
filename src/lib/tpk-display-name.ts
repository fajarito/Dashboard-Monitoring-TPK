import type { TpkListItem } from "@/lib/data/types";

type TpkNameFields = Pick<
  TpkListItem,
  "namaKelurahan" | "nama" | "tpkId" | "nomorRegister"
>;

/**
 * Nama tampilan daftar: `TPK (Nama Desa/Kelurahan)`.
 * Hindari nama palsu dari NamaTPK simulasi bila nama kelurahan sudah ada.
 */
export function formatTpkDisplayName(item: TpkNameFields): string {
  const desa = item.namaKelurahan?.trim();
  if (desa) return `TPK (${desa})`;

  const raw = item.nama?.trim();
  if (raw) {
    // Sudah format TPK (…) — biarkan.
    if (/^TPK\s*\(/i.test(raw)) return raw;
  }

  const reg = item.nomorRegister?.trim();
  if (reg) return `TPK (reg ${reg})`;
  return `TPK (${item.tpkId})`;
}

/** Cuplikan TPKID untuk subline — bedakan tim se-desa tanpa mengotori judul. */
export function tpkIdSnippet(tpkId: string): string {
  const trimmed = tpkId.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return trimmed;
  return trimmed.slice(-8);
}

export type TpkRowLabel = {
  /** `TPK (Desa)` atau `TPK (Desa) · #n` bila ada duplikat label di halaman. */
  displayName: string;
  /** True bila label dasar (desa) muncul >1× di halaman — tampilkan ID di subline. */
  showTpkIdInSubline: boolean;
};

/**
 * Satu label per baris halaman. Tim se-desa tetap satu baris masing-masing (beda TPKID),
 * tapi judul dibedakan dengan `· #n` (urut TPKID) dan flag subline ID.
 */
export function resolveTpkRowLabels(
  items: readonly TpkNameFields[],
): Map<string, TpkRowLabel> {
  const baseById = new Map<string, string>();
  const countByBase = new Map<string, number>();

  for (const item of items) {
    const base = formatTpkDisplayName(item);
    baseById.set(item.tpkId, base);
    countByBase.set(base, (countByBase.get(base) ?? 0) + 1);
  }

  const indexById = new Map<string, number>();
  const idsByBase = new Map<string, string[]>();
  for (const item of items) {
    const base = baseById.get(item.tpkId)!;
    if ((countByBase.get(base) ?? 0) < 2) continue;
    const list = idsByBase.get(base) ?? [];
    list.push(item.tpkId);
    idsByBase.set(base, list);
  }
  for (const ids of idsByBase.values()) {
    ids.sort((a, b) => a.localeCompare(b, "id"));
    ids.forEach((id, i) => indexById.set(id, i + 1));
  }

  const out = new Map<string, TpkRowLabel>();
  for (const item of items) {
    const base = baseById.get(item.tpkId)!;
    const n = indexById.get(item.tpkId);
    out.set(item.tpkId, {
      displayName: n != null ? `${base} · #${n}` : base,
      showTpkIdInSubline: n != null,
    });
  }
  return out;
}

/** Satu baris per TPKID (pertahankan urutan pertama). */
export function dedupeByTpkId<T extends { tpkId: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = row.tpkId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}
