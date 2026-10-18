/**
 * Smoke: DATA_SOURCE=mock tetap mengembalikan meta.source=mock.
 * Jalankan: node --import tsx ... tidak dipakai; pakai build + curl,
 * atau: DATA_SOURCE=mock node scripts/smoke-mock-data.mjs (setelah build via dynamic import path).
 *
 * Versi ringan tanpa Next: validasi helper parse + mock langsung lewat compiled tidak tersedia.
 * Skrip ini memanggil fetch ke server lokal jika SMOKE_BASE_URL di-set.
 */
const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");

if (!base) {
  console.log("skip: set SMOKE_BASE_URL=http://127.0.0.1:PORT to smoke HTTP");
  process.exit(0);
}

async function check(path, expectSource) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  const source = json?.meta?.source;
  if (source !== expectSource) {
    throw new Error(`${path} meta.source=${source}, expected ${expectSource}`);
  }
  console.log(`OK ${path} source=${source}`);
}

await check("/api/ringkasan?tingkat=nasional", "mock");

{
  const path = "/api/peringkat/provinsi";
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json?.meta?.source !== "mock") {
    throw new Error(`${path} meta.source=${json?.meta?.source}, expected mock`);
  }
  const item = json?.items?.[0];
  for (const key of ["id", "nama", "tpk", "pkb", "desa", "krs", "rasio", "rasioPkbDesa", "warningBeban"]) {
    if (item == null || item[key] === undefined) {
      throw new Error(`${path} items[0] missing ${key}`);
    }
  }
  if (typeof item.pkb !== "number" || typeof item.desa !== "number") {
    throw new Error(`${path} pkb/desa must be numbers`);
  }
  console.log(
    `OK ${path} source=mock n=${json.items.length} sample id=${item.id} pkb=${item.pkb} desa=${item.desa} rasioPkbDesa=${item.rasioPkbDesa}`,
  );
}

console.log("smoke mock OK");
