/**
 * Verifikasi kontrak GET /api/keluarga/detail by **KKI** (mock).
 * SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-keluarga-detail.mjs
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!base) {
  console.error("Set SMOKE_BASE_URL=http://127.0.0.1:PORT");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const missing = await fetch(`${base}/api/keluarga/detail`);
assert(missing.status === 400, `missing kki expected 400 got ${missing.status}`);

const kki = "11061020310200      001019026";
const res = await fetch(
  `${base}/api/keluarga/detail?kki=${encodeURIComponent(kki)}&provinsiId=1`,
);
const json = await res.json();
assert(res.ok, `HTTP ${res.status}: ${json.message || ""}`);
assert(json.meta?.source === "mock", `source=${json.meta?.source}`);
assert(json.join?.key === "kki", "join.key");
assert(json.join?.pinField === "kki", "join.pinField");
assert(json.join?.headField === "kki", "join.headField");
assert(json.item?.kki, "item.kki");
assert(json.item?.namaKepalaKeluarga, "nama");
assert(json.item?.rumah?.atap, "rumah.atap");
assert(json.item?.jamban?.kondisi, "jamban");
assert(json.item?.air?.sumber, "air");
assert(!("nik" in (json.item || {})), "no NIK field");
assert(!("nikKk" in (json.item || {})), "no nikKk");

const compact = await fetch(
  `${base}/api/keluarga/detail?kki=${encodeURIComponent("11061020310200001019026")}`,
);
const cjson = await compact.json();
assert(compact.ok, "compact kki join");
assert(cjson.item?.idStunting === json.item.idStunting, "same row via compact");

const miss = await fetch(
  `${base}/api/keluarga/detail?kki=${encodeURIComponent("99999999999999      000000000")}`,
);
assert(miss.status === 404, `unknown kki expected 404 got ${miss.status}`);

console.log("verify-keluarga-detail OK", {
  nama: json.item.namaKepalaKeluarga,
  kki: json.item.kki,
  atap: json.item.rumah.atap,
  fotoRumah: Boolean(json.item.fotoRumahUrl),
  fotoJamban: Boolean(json.item.fotoJambanUrl),
});
