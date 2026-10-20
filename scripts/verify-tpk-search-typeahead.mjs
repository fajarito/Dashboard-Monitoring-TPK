/**
 * Verifikasi cari TPK server-side (q) + relevansi + scope.
 *
 * Unit: node scripts/verify-tpk-search-typeahead.mjs
 * HTTP: SMOKE_BASE_URL=http://127.0.0.1:PORT node scripts/verify-tpk-search-typeahead.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Mirror ranking: 0 exact register → 1 prefix desa → 2 partial. */
function relevanceRank(item, q) {
  const needle = q.trim().toLowerCase();
  const reg = item.nomorRegister?.trim().toLowerCase() ?? "";
  if (reg && reg === needle) return 0;
  const desa = item.namaKelurahan?.trim().toLowerCase() ?? "";
  if (desa.startsWith(needle)) return 1;
  return 2;
}

// --- unit ---
{
  assert(relevanceRank({ nomorRegister: "101", namaKelurahan: "X" }, "101") === 0, "exact reg");
  assert(relevanceRank({ nomorRegister: "9", namaKelurahan: "RAGAJAYA" }, "raga") === 1, "prefix desa");
  assert(relevanceRank({ nomorRegister: "9", namaKelurahan: "BOJONG" }, "rina") === 2, "partial");
  console.log("OK unit relevanceRank");
}

const base = process.env.SMOKE_BASE_URL?.replace(/\/$/, "");
if (!base) {
  console.log("verify-tpk-search-typeahead OK (unit only)");
  process.exit(0);
}

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  const json = await res.json();
  assert(res.ok, `${path} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

{
  const path = "/api/tpk?provinsiId=12&pageSize=10&sort=nama&q=RAGAJAYA";
  const json = await getJson(path);
  assert(Array.isArray(json.items) && json.items.length >= 1, `${path} expected items`);
  assert(json.total >= json.items.length, `${path} total`);
  assert(
    json.items.every((it) =>
      (it.namaKelurahan || "").toUpperCase().includes("RAGAJAYA"),
    ),
    `${path} semua item harus desa RAGAJAYA (scope + match)`,
  );
  assert(json.items.length <= 10, `${path} typeahead pageSize≤10`);
  console.log(`OK ${path} n=${json.items.length} total=${json.total}`);
}

{
  // Scope: Jabar tidak boleh mengeluarkan Sleman (DIY).
  const path = "/api/tpk?provinsiId=12&pageSize=25&q=Sleman";
  const json = await getJson(path);
  const leaked = (json.items || []).filter((it) =>
    /sleman/i.test(
      `${it.namaKabupaten || ""} ${it.namaKecamatan || ""} ${it.namaKelurahan || ""} ${it.nama || ""}`,
    ),
  );
  assert(leaked.length === 0, `${path} jangan sarankan Sleman di Jabar`);
  console.log(`OK ${path} total=${json.total} (tanpa Sleman)`);
}

{
  // PKB name search (mock Sukamaju → Rina Maulana).
  const path = "/api/tpk?provinsiId=12&pageSize=10&q=Rina";
  const json = await getJson(path);
  assert(json.total >= 1, `${path} expected PKB/anggota match`);
  const hit = json.items.some(
    (it) =>
      /rina/i.test(it.pkb?.nama || "") ||
      (it.anggota || []).some((n) => /rina/i.test(n)),
  );
  assert(hit, `${path} expected Rina di pkb/anggota pada hasil`);
  console.log(`OK ${path} total=${json.total}`);
}

{
  // NomorRegister exact — mock code slice(-3); pastikan ranking exact di depan bila ada.
  const list = await getJson("/api/tpk?provinsiId=12&pageSize=50&sort=nama&q=RAGAJAYA");
  const sampleReg = list.items[0]?.nomorRegister?.trim();
  if (sampleReg) {
    const path = `/api/tpk?provinsiId=12&pageSize=10&q=${encodeURIComponent(sampleReg)}`;
    const json = await getJson(path);
    assert(json.total >= 1, `${path} register hit`);
    const ranks = json.items.map((it) => relevanceRank(it, sampleReg));
    assert(ranks[0] === 0 || ranks.every((r) => r >= ranks[0]), `${path} relevansi non-naik`);
    console.log(`OK ${path} firstRank=${ranks[0]} n=${json.items.length}`);
  } else {
    console.log("SKIP register exact (no nomorRegister on RAGAJAYA sample)");
  }
}

{
  // Filter kab tetap bekerja bersama q.
  const path =
    "/api/tpk?provinsiId=12&kabupatenId=166&pageSize=10&q=Beji";
  const json = await getJson(path);
  assert(json.filters?.kabupatenId === 166, `${path} filters.kabupatenId`);
  console.log(`OK ${path} total=${json.total} filters.kab=${json.filters.kabupatenId}`);
}

console.log("verify-tpk-search-typeahead OK");
