/**
 * Unit ringan (tanpa Next) untuk dedupe + label se-desa + NomorRegister.
 * Jalankan: node scripts/verify-tpk-list-dedupe.mjs
 */

function formatTpkDesaTitle(item) {
  const desa = item.namaKelurahan?.trim();
  if (desa) return `TPK (${desa})`;
  const raw = item.nama?.trim();
  if (raw && /^TPK\s*\(/i.test(raw)) return raw;
  const reg = item.nomorRegister?.trim();
  if (reg) return `TPK (reg ${reg})`;
  return `TPK (${item.tpkId})`;
}

function formatTpkDisplayName(item) {
  const desaTitle = formatTpkDesaTitle(item);
  if (/^TPK \(reg /i.test(desaTitle)) return desaTitle;
  const reg = item.nomorRegister?.trim();
  if (reg) return `${desaTitle} - ${reg}`;
  return desaTitle;
}

function resolveTpkRowLabels(items) {
  const baseById = new Map();
  const countByBase = new Map();
  for (const item of items) {
    const base = formatTpkDisplayName(item);
    baseById.set(item.tpkId, base);
    countByBase.set(base, (countByBase.get(base) ?? 0) + 1);
  }
  const indexById = new Map();
  const idsByBase = new Map();
  for (const item of items) {
    const base = baseById.get(item.tpkId);
    if ((countByBase.get(base) ?? 0) < 2) continue;
    const list = idsByBase.get(base) ?? [];
    list.push(item.tpkId);
    idsByBase.set(base, list);
  }
  for (const ids of idsByBase.values()) {
    ids.sort((a, b) => a.localeCompare(b, "id"));
    ids.forEach((id, i) => indexById.set(id, i + 1));
  }
  const out = new Map();
  for (const item of items) {
    const base = baseById.get(item.tpkId);
    const n = indexById.get(item.tpkId);
    out.set(item.tpkId, {
      displayName: n != null ? `${base} · #${n}` : base,
      showTpkIdInSubline: n != null,
    });
  }
  return out;
}

function dedupeByTpkId(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const id = row.tpkId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

// --- assertions ---
const dupRows = [
  { tpkId: "A", namaKelurahan: "RAGAJAYA", nomorRegister: "101" },
  { tpkId: "A", namaKelurahan: "RAGAJAYA", nomorRegister: "101" }, // fan-out bug
  { tpkId: "B", namaKelurahan: "RAGAJAYA", nomorRegister: "102" },
  { tpkId: "C", namaKelurahan: "BOJONG", nomorRegister: "200" },
];
const deduped = dedupeByTpkId(dupRows);
if (deduped.length !== 3) {
  throw new Error(`dedupe expected 3, got ${deduped.length}`);
}

const labels = resolveTpkRowLabels(deduped);
const a = labels.get("A");
const b = labels.get("B");
const c = labels.get("C");
if (a.displayName !== "TPK (RAGAJAYA) - 101") {
  throw new Error(`A label=${a.displayName}`);
}
if (b.displayName !== "TPK (RAGAJAYA) - 102") {
  throw new Error(`B label=${b.displayName}`);
}
if (a.showTpkIdInSubline || b.showTpkIdInSubline) {
  throw new Error("distinct NomorRegister should not need TPKID subline");
}
if (c.displayName !== "TPK (BOJONG) - 200" || c.showTpkIdInSubline) {
  throw new Error(`C should stay plain+register: ${JSON.stringify(c)}`);
}

// Bentrok tanpa register unik → · #n
const clash = resolveTpkRowLabels([
  { tpkId: "X1", namaKelurahan: "RAGAJAYA" },
  { tpkId: "X2", namaKelurahan: "RAGAJAYA" },
]);
if (clash.get("X1").displayName !== "TPK (RAGAJAYA) · #1") {
  throw new Error(`clash X1=${clash.get("X1").displayName}`);
}
if (clash.get("X2").displayName !== "TPK (RAGAJAYA) · #2") {
  throw new Error(`clash X2=${clash.get("X2").displayName}`);
}

console.log("OK dedupeByTpkId + resolveTpkRowLabels (TPK (Desa) - Register)");
console.log("verify-tpk-list-dedupe OK");
