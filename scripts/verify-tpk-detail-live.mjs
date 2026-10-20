/**
 * Verifikasi kontrak GET /api/tpk/[tpkId] (mock).
 * SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-tpk-detail-live.mjs
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!base) {
  console.error("Set SMOKE_BASE_URL=http://127.0.0.1:PORT");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const res = await fetch(`${base}/api/tpk/jabar-tpk-01`);
const json = await res.json();
assert(res.ok, `HTTP ${res.status}`);
assert(json.meta?.source === "mock", `source=${json.meta?.source}`);
assert(typeof json.nama === "string" && json.nama.includes("TPK"), "nama TPK");
assert(Array.isArray(json.anggota) && json.anggota.length >= 1, "anggota");
assert(json.anggota[0].peran, "anggota.peran");
assert(json.pkb?.nama, "pkb");
assert(typeof json.keluargaSasaran === "number", "keluargaSasaran");
assert(typeof json.krs === "number", "krs");
assert(json.indikator?.rtlh === null, "rtlh null");
assert(Array.isArray(json.keluarga) && json.keluarga.length === 0, "keluarga stub");
assert(json.komposisiPrioritas != null, "komposisiPrioritas");
assert(json.wilayah?.namaProvinsi || json.wilayah?.namaKelurahan, "wilayah path");

const missing = await fetch(`${base}/api/tpk/no-such-tpk`);
assert(missing.status === 404, `missing expected 404 got ${missing.status}`);

console.log("verify-tpk-detail-live OK", {
  nama: json.nama,
  anggota: json.anggota.length,
  krs: json.krs,
  pkb: json.pkb.nama,
  tpkSeDesa: json.tpkSeDesa,
});
