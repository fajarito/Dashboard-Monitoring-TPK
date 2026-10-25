/**
 * Verifikasi kontrak GET /api/keluarga/points (mock).
 * SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-krs-points.mjs
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!base) {
  console.error("Set SMOKE_BASE_URL=http://127.0.0.1:PORT");
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const kelurahanId = "1660101";
const provinsiId = "12";

const missing = await fetch(`${base}/api/keluarga/points`);
assert(missing.status === 400, `missing params expected 400 got ${missing.status}`);

const res = await fetch(
  `${base}/api/keluarga/points?kelurahanId=${kelurahanId}&provinsiId=${provinsiId}&limit=50`,
);
const json = await res.json();
assert(res.ok, `HTTP ${res.status}: ${json.message || ""}`);
assert(json.meta?.source === "mock", `source=${json.meta?.source}`);
assert(Array.isArray(json.items), "items array");
assert(json.items.length >= 1, "items not empty");
assert(typeof json.total === "number" && json.total >= json.items.length, "total");
assert(json.returned === json.items.length, "returned");
assert(json.limit === 50, "limit");
assert(json.grain?.level === "kelurahan", "grain");
assert(json.grain?.kelurahanId === Number(kelurahanId), "grain.kelurahanId");
assert(
  Array.isArray(json.filters?.indikator) && json.filters.indikator.includes("krs"),
  "default indikator=krs",
);
assert(json.filters?.validCoordsOnly === true, "default validCoordsOnly");

const first = json.items[0];
assert(first.kodeKeluarga && first.namaKepalaKeluarga, "identity");
assert(typeof first.latitude === "number" && typeof first.longitude === "number", "coords");
assert(first.latitude >= -11.5 && first.latitude <= 6.5, "lat range");
assert(first.longitude >= 94.5 && first.longitude <= 141.5, "lng range");
assert(
  ["p1", "p2", "p3", "p4", "bukan", "tidakRisiko"].includes(first.prioritas),
  `prioritas=${first.prioritas}`,
);
assert(typeof first.krs === "boolean", "krs flag");
assert(!("nik" in first), "no NIK");

const codes = json.items.map((i) => i.kodeKeluarga);
assert(new Set(codes).size === codes.length, "DISTINCT kode_keluarga");

const filtered = await fetch(
  `${base}/api/keluarga/points?kelurahanId=${kelurahanId}&provinsiId=${provinsiId}&prioritas=p1&indikator=krs&limit=50`,
);
const fjson = await filtered.json();
assert(filtered.ok, `filter HTTP ${filtered.status}`);
assert(
  fjson.items.every((i) => i.prioritas === "p1" && i.krs === true),
  "prioritas=p1 + indikator=krs",
);

const hard = await fetch(
  `${base}/api/keluarga/points?kelurahanId=${kelurahanId}&provinsiId=${provinsiId}&limit=9999`,
);
const hjson = await hard.json();
assert(hard.ok, "hard max request ok");
assert(hjson.limit <= 2000, `limit capped got ${hjson.limit}`);

const q = first.namaKepalaKeluarga.slice(0, Math.min(4, first.namaKepalaKeluarga.length));
if (q.length >= 2) {
  const search = await fetch(
    `${base}/api/keluarga/points?kelurahanId=${kelurahanId}&provinsiId=${provinsiId}&q=${encodeURIComponent(q)}&limit=50`,
  );
  const sjson = await search.json();
  assert(search.ok, `q HTTP ${search.status}`);
  assert(
    sjson.items.every((i) =>
      i.namaKepalaKeluarga.toLowerCase().includes(q.toLowerCase()),
    ),
    "q filters nama KK",
  );
}

console.log("verify-krs-points OK", {
  total: json.total,
  returned: json.returned,
  truncated: json.truncated,
  grain: json.grain.namaKelurahan,
  sample: {
    nama: first.namaKepalaKeluarga,
    prioritas: first.prioritas,
    lat: first.latitude,
    lng: first.longitude,
  },
});
