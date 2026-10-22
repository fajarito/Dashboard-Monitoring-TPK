/**
 * Verifikasi kontrak GET /api/tpk/[tpkId]/keluarga (mock).
 * SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-tpk-keluarga.mjs
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!base) {
  console.error("Set SMOKE_BASE_URL=http://127.0.0.1:PORT");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tpkId = "jabar-tpk-01";
const res = await fetch(
  `${base}/api/tpk/${encodeURIComponent(tpkId)}/keluarga?page=1&pageSize=10`,
);
const json = await res.json();
assert(res.ok, `HTTP ${res.status}`);
assert(json.meta?.source === "mock", `source=${json.meta?.source}`);
assert(json.tpkId === tpkId, "tpkId");
assert(Array.isArray(json.items), "items array");
assert(json.items.length >= 1, "items not empty");
assert(typeof json.total === "number" && json.total >= json.items.length, "total");
assert(json.page === 1 && json.pageSize === 10, "paging");
assert(json.grain?.level === "kelurahan", "grain kelurahan");
assert(typeof json.grain?.tpkSeDesa === "number", "tpkSeDesa");

const first = json.items[0];
assert(first.kodeKeluarga && first.namaKepalaKeluarga, "identity");
assert(
  ["p1", "p2", "p3", "p4", "bukan", "tidakRisiko"].includes(first.prioritas),
  `prioritas=${first.prioritas}`,
);
assert(typeof first.indikator?.krs === "boolean", "indikator.krs");
assert(first.indikator?.rtlh === false, "rtlh false");
assert(!("nik" in first), "no NIK in list payload");

const codes = json.items.map((i) => i.kodeKeluarga);
assert(new Set(codes).size === codes.length, "DISTINCT kode_keluarga");

const page2 = await fetch(
  `${base}/api/tpk/${encodeURIComponent(tpkId)}/keluarga?page=2&pageSize=5`,
);
const p2 = await page2.json();
assert(page2.ok, `page2 HTTP ${page2.status}`);
assert(p2.page === 2 && p2.pageSize === 5, "page2 params");
if (json.total > 5) {
  assert(p2.items.length >= 1, "page2 has items");
  assert(
    p2.items[0].kodeKeluarga !== json.items[0].kodeKeluarga,
    "page2 advances",
  );
}

const filtered = await fetch(
  `${base}/api/tpk/${encodeURIComponent(tpkId)}/keluarga?page=1&pageSize=10&indikator=krs`,
);
const fjson = await filtered.json();
assert(filtered.ok, `filter HTTP ${filtered.status}`);
assert(
  fjson.items.every((i) => i.indikator.krs === true),
  "indikator=krs filters",
);

const missing = await fetch(`${base}/api/tpk/no-such-tpk/keluarga`);
assert(missing.status === 404, `missing expected 404 got ${missing.status}`);

// Detail tetap stub keluarga []
const detail = await fetch(`${base}/api/tpk/${encodeURIComponent(tpkId)}`);
const djson = await detail.json();
assert(detail.ok, "detail ok");
assert(Array.isArray(djson.keluarga) && djson.keluarga.length === 0, "detail stub");

console.log("verify-tpk-keluarga OK", {
  total: json.total,
  pageItems: json.items.length,
  grain: json.grain.namaKelurahan,
  tpkSeDesa: json.grain.tpkSeDesa,
  sample: first.namaKepalaKeluarga,
});
