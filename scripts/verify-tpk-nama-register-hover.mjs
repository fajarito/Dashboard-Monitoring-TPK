/**
 * Unit + HTTP checks for TPK title `TPK (Desa) - NomorRegister`
 * and indikator remaining on API (UI shows on hover only).
 *
 * Unit: node scripts/verify-tpk-nama-register-hover.mjs
 * HTTP: SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-tpk-nama-register-hover.mjs
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

// --- unit ---
{
  const titled = formatTpkDisplayName({
    tpkId: "1",
    namaKelurahan: "RAGAJAYA",
    nomorRegister: "12345",
    nama: null,
  });
  if (titled !== "TPK (RAGAJAYA) - 12345") {
    throw new Error(`title separator failed: ${titled}`);
  }
  // exact separator: space-dash-space
  if (!titled.includes(" - ")) {
    throw new Error("missing exact separator ' - '");
  }
  const noReg = formatTpkDisplayName({
    tpkId: "2",
    namaKelurahan: "BOJONG",
    nomorRegister: null,
    nama: null,
  });
  if (noReg !== "TPK (BOJONG)") {
    throw new Error(`no-register title failed: ${noReg}`);
  }
  console.log("OK unit formatTpkDisplayName");
}

const base = process.env.SMOKE_BASE_URL;
if (!base) {
  console.log("verify-tpk-nama-register-hover OK (unit only)");
  process.exit(0);
}

const path =
  "/api/tpk?provinsiId=12&pageSize=50&sort=nama&q=RAGAJAYA";
const res = await fetch(`${base}${path}`);
const json = await res.json();
if (!res.ok) {
  throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
}
if (!Array.isArray(json.items) || json.items.length < 2) {
  throw new Error(`${path} expected ≥2 RAGAJAYA items, got ${json.items?.length}`);
}

for (const item of json.items) {
  if (item.nomorRegister == null || String(item.nomorRegister).trim() === "") {
    throw new Error(`item ${item.tpkId} missing nomorRegister`);
  }
  for (const key of ["bumil", "baduta", "balita", "jambanTL", "airTL", "rtlh"]) {
    if (item.indikator?.[key] === undefined) {
      throw new Error(`item ${item.tpkId} indikator.${key} missing`);
    }
  }
  const title = formatTpkDisplayName(item);
  const expected = `TPK (${item.namaKelurahan}) - ${String(item.nomorRegister).trim()}`;
  if (title !== expected) {
    throw new Error(`title mismatch: got ${title} expected ${expected}`);
  }
}

const regs = new Set(json.items.map((i) => String(i.nomorRegister).trim()));
if (regs.size < 2) {
  throw new Error("expected distinct nomorRegister among RAGAJAYA rows");
}

console.log(
  `OK HTTP ${path} n=${json.items.length} titles=[${json.items
    .slice(0, 2)
    .map((i) => formatTpkDisplayName(i))
    .join(" | ")}]`,
);
console.log("verify-tpk-nama-register-hover OK");
