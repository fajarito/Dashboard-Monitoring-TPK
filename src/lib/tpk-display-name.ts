import type { TpkListItem } from "@/lib/data/types";

/**
 * Nama tampilan daftar: `TPK (Nama Desa/Kelurahan)`.
 * Hindari nama palsu dari NamaTPK simulasi bila nama kelurahan sudah ada.
 */
export function formatTpkDisplayName(
  item: Pick<TpkListItem, "namaKelurahan" | "nama" | "tpkId" | "nomorRegister">,
): string {
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
