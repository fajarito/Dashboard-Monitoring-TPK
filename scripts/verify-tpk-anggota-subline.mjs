/**
 * Unit + HTTP checks for anggota subline + agregat desa caption helpers.
 * Unit: node scripts/verify-tpk-anggota-subline.mjs
 * HTTP: SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-tpk-anggota-subline.mjs
 */

function formatAnggotaSubline(names) {
  return names
    .map((n) => String(n).trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function formatAgregatDesaCaption(tpkSeDesa) {
  if (!Number.isFinite(tpkSeDesa) || tpkSeDesa < 2) return null;
  return `Agregat desa · ${tpkSeDesa} TPK`;
}

function pickAnggotaNames(rows) {
  const names = [];
  const seen = new Set();
  for (const row of rows) {
    const nama = row.nama?.trim();
    if (!nama) continue;
    const key = nama.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(nama);
    if (names.length >= 3) break;
  }
  return names;
}

// --- unit ---
if (formatAnggotaSubline(["A", " B ", "", "C", "D"]) !== "A · B · C") {
  throw new Error("formatAnggotaSubline failed");
}
if (formatAgregatDesaCaption(1) !== null) {
  throw new Error("caption should be null for N=1");
}
if (formatAgregatDesaCaption(3) !== "Agregat desa · 3 TPK") {
  throw new Error("caption N=3 failed");
}
const picked = pickAnggotaNames([
  { nama: "Bidan Satu", status_tpk: 1 },
  { nama: "PKK Dua", status_tpk: 2 },
  { nama: "Kader Tiga", status_tpk: 3 },
  { nama: "Lain", status_tpk: 9 },
]);
if (picked.join("|") !== "Bidan Satu|PKK Dua|Kader Tiga") {
  throw new Error(`pickAnggotaNames=${picked.join("|")}`);
}
console.log("OK unit anggota/agregat helpers");

const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");
if (!base) {
  console.log("skip HTTP: set SMOKE_BASE_URL to verify /api/tpk shape");
  process.exit(0);
}

const path =
  "/api/tpk?provinsiId=12&page=1&pageSize=50&sort=nama&q=RAGAJAYA";
const res = await fetch(`${base}${path}`);
const json = await res.json();
if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
if (!Array.isArray(json.items) || json.items.length < 2) {
  throw new Error(`${path} expected ≥2 RAGAJAYA rows, got ${json.items?.length}`);
}

const lines = new Set();
for (const item of json.items) {
  if (!Array.isArray(item.anggota) || item.anggota.length === 0) {
    throw new Error(`tpk ${item.tpkId} missing anggota`);
  }
  if ((item.tpkSeDesa ?? 0) < 2) {
    throw new Error(
      `tpk ${item.tpkId} tpkSeDesa=${item.tpkSeDesa}, expected ≥2 for RAGAJAYA`,
    );
  }
  lines.add(formatAnggotaSubline(item.anggota));
  if (item.namaKelurahan !== "RAGAJAYA") {
    throw new Error(`unexpected desa ${item.namaKelurahan}`);
  }
}

if (lines.size < 2) {
  throw new Error(
    `expected distinct anggota sublines among RAGAJAYA, got ${lines.size}`,
  );
}

const krsSet = new Set(json.items.map((i) => i.krs));
const sasSet = new Set(json.items.map((i) => i.keluargaSasaran));
console.log(
  `OK HTTP ${path} n=${json.items.length} distinctAnggotaLines=${lines.size} krsValues=${[...krsSet]} sasaranValues=${[...sasSet]} tpkSeDesa=${json.items[0].tpkSeDesa}`,
);
console.log("verify-tpk-anggota-subline OK");
