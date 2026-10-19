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
  const path = "/api/ringkasan?tingkat=provinsi&id=12";
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  if (json.tingkat !== "provinsi" || json.id !== "12") {
    throw new Error(`${path} unexpected tingkat/id`);
  }
  console.log(`OK ${path} tpk=${json.jumlahTPK}`);
}

{
  const path = "/api/ringkasan?tingkat=kabupaten&id=166";
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  if (json.tingkat !== "kabupaten" || json.id !== "166") {
    throw new Error(`${path} unexpected tingkat/id: ${json.tingkat}/${json.id}`);
  }
  if (typeof json.jumlahTPK !== "number") {
    throw new Error(`${path} missing jumlahTPK`);
  }
  console.log(`OK ${path} tpk=${json.jumlahTPK} (Kota Depok)`);
}

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

{
  const path = "/api/peringkat/kabupaten?provinsiId=12";
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  if (!Array.isArray(json.items) || json.items.length === 0) {
    throw new Error(`${path} empty items`);
  }
  const sample = json.items[0];
  for (const key of [
    "id",
    "nama",
    "tpk",
    "pkb",
    "desa",
    "krs",
    "keluargaSasaran",
    "rasio",
    "rasioPkbDesa",
    "warningBeban",
    "indikator",
  ]) {
    if (sample == null || sample[key] === undefined) {
      throw new Error(`${path} items[0] missing ${key}`);
    }
  }
  for (const key of ["bumil", "baduta", "balita", "jambanTL", "airTL", "rtlh"]) {
    if (sample.indikator?.[key] === undefined) {
      throw new Error(`${path} items[0].indikator missing ${key}`);
    }
  }
  const depok = json.items.find((i) => i.id === "166" || /depok/i.test(i.nama));
  console.log(
    `OK ${path} n=${json.items.length} depok=${depok ? `${depok.id}/${depok.tpk}/sasaran=${depok.keluargaSasaran}` : "n/a"}`,
  );
}

{
  const path = "/api/tpk?provinsiId=12&page=1&pageSize=25&sort=krs-desc";
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  if (!Array.isArray(json.items)) throw new Error(`${path} items missing`);
  if (json.pageSize > 50) throw new Error(`${path} pageSize too large`);
  const sample = json.items[0];
  if (!sample) throw new Error(`${path} empty page`);
  for (const key of [
    "keluargaSasaran",
    "krs",
    "indikator",
    "pkb",
  ]) {
    if (sample[key] === undefined) {
      throw new Error(`${path} items[0] missing ${key}`);
    }
  }
  for (const key of ["bumil", "baduta", "balita", "jambanTL", "airTL", "rtlh"]) {
    if (sample.indikator?.[key] === undefined) {
      throw new Error(`${path} items[0].indikator missing ${key}`);
    }
  }
  if (sample.indikator.rtlh !== null) {
    throw new Error(`${path} indikator.rtlh must be null`);
  }
  if (!sample.pkb || !sample.pkb.nama) {
    throw new Error(`${path} mock pkb.nama expected`);
  }
  if (typeof sample.krs !== "number" || sample.krs < 0) {
    throw new Error(`${path} mock krs should be number`);
  }
  // KRS desc: first >= second when both present
  if (json.items.length >= 2) {
    const a = json.items[0].krs;
    const b = json.items[1].krs;
    if (typeof a === "number" && typeof b === "number" && a < b) {
      throw new Error(`${path} sort=krs-desc violated: ${a} < ${b}`);
    }
  }
  console.log(
    `OK ${path} total=${json.total} pageItems=${json.items.length} sample krs=${sample.krs} pkb=${sample.pkb.nama}`,
  );
}

{
  const path = "/api/tpk";
  const res = await fetch(`${base}${path}`);
  if (res.status !== 400) {
    throw new Error(`${path} expected 400 without filter, got ${res.status}`);
  }
  console.log(`OK ${path} → 400 tanpa filter wilayah`);
}

console.log("smoke mock OK");
