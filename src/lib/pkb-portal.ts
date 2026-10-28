/**
 * Integrasi API Portal PKB (UAT) + foto SIMSDM.
 * Server-side only — jangan import dari client component.
 * Helper lookup murni: `pkb-portal-lookup.ts` (aman di client).
 *
 * Auth: set PKB_PORTAL_API_TOKEN (Bearer). Tanpa token → stub/fallback lokal.
 * Agregat jumlah PKB tidak diubah di sini.
 */

export {
  isValidNikKtp,
  isValidNipPns,
  isWilayahCode,
  normalizePortalLokasiName,
  resolvePortalLokasiNames,
  resolvePortalLookupFromPkb,
  resolvePortalLookupKey,
  resolvePortalLookupNip,
  type PkbPortalLookupKey,
  type PkbPortalLookupKind,
  type PkbPortalLokasiNames,
} from "@/lib/pkb-portal-lookup";

import {
  resolvePortalLokasiNames,
  resolvePortalLookupKey,
  type PkbPortalLookupKey,
} from "@/lib/pkb-portal-lookup";

export type PkbPortalRecord = {
  NIP: string;
  /** NIK/KTP dari response portal (field `ktp`). */
  ktp: string | null;
  nama: string;
  nohp: string | null;
  jenispegawai: string | null;
  statuspegawai: string | null;
  foto: string | null;
  lokasi_propinsi: string | null;
  lokasi_kabupaten: string | null;
  lokasi_kecamatan: string | null;
  lokasi_kelurahan: string | null;
  email_dinas: string | null;
  jab_akhir: string | null;
  /** Label pelatihan/diklat/sertifikasi dari portal (jika ada). */
  pelatihanLabels: string[];
};

export type PkbPortalLokasi = {
  /** Nama provinsi (bukan kode). */
  propinsi: string;
  /** Nama kabupaten/kota (bukan kode). */
  kabupaten: string;
  /** Nama kecamatan (bukan kode). */
  kecamatan?: string;
  /** Nama kelurahan/desa (bukan kode). */
  kelurahan?: string;
  statuspegawai?: string;
};

export type PkbPortalSource = "portal" | "stub" | "fallback";

export type PkbPortalEnrichment = {
  source: PkbPortalSource;
  /** NIP dari response portal (`NIP`) — bukan NIK KTP. */
  nip: string;
  nama: string;
  nohp: string | null;
  emailDinas: string | null;
  jabAkhir: string | null;
  statusPegawai: string | null;
  jenisPegawai: string | null;
  lokasiPropinsi: string | null;
  lokasiKabupaten: string | null;
  lokasiKecamatan: string | null;
  lokasiKelurahan: string | null;
  fotoFile: string | null;
  /**
   * URL foto untuk <img>:
   * - portal → proxy same-origin `/api/pkb/foto?file=…` (hindari hotlink/CORS SIMSDM)
   * - stub → aset lokal
   */
  fotoUrl: string | null;
  pelatihanLabels: string[];
  error: string | null;
};

const DEFAULT_PORTAL_BASE =
  "https://api-portal.apps.ocp-uat.bkkbn.go.id";
const DEFAULT_SIMSDM_FOTO_BASE =
  "https://simsdm.bkkbn.go.id/assets/uploads/pictures";

/** NIP contoh UAT (Bali / Kota Denpasar) — untuk stub & smoke. */
export const PKB_PORTAL_DEMO_NIP = "196803291988032003";
/** NIK/KTP contoh yang dipetakan ke stub demo (tanpa token). */
export const PKB_PORTAL_DEMO_KTP = "5171046903680003";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getPkbPortalBaseUrl(): string {
  return (
    readEnv("PKB_PORTAL_API_BASE_URL")?.replace(/\/$/, "") ??
    DEFAULT_PORTAL_BASE
  );
}

export function getSimsdmFotoBaseUrl(): string {
  return (
    readEnv("SIMSDM_FOTO_BASE_URL")?.replace(/\/$/, "") ??
    DEFAULT_SIMSDM_FOTO_BASE
  );
}

/**
 * Normalisasi token dari .env.
 * Jika value sudah `Bearer xxx`, jangan double-prefix di header.
 */
export function normalizePortalBearerToken(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "").trim() || null;
}

/** Token mentah Bearer (tanpa kata "Bearer "). Kosong = stub/fallback. */
export function getPkbPortalToken(): string | null {
  return normalizePortalBearerToken(
    readEnv("PKB_PORTAL_API_TOKEN") ?? readEnv("PKB_PORTAL_API_KEY"),
  );
}

/** Diagnostik aman (tanpa membocorkan token). */
export function getPkbPortalAuthDiag(): {
  tokenConfigured: boolean;
  tokenHadBearerPrefix: boolean;
  envKeysPresent: string[];
  baseUrl: string;
} {
  const raw =
    readEnv("PKB_PORTAL_API_TOKEN") ?? readEnv("PKB_PORTAL_API_KEY");
  const envKeysPresent: string[] = [];
  if (readEnv("PKB_PORTAL_API_TOKEN")) envKeysPresent.push("PKB_PORTAL_API_TOKEN");
  if (readEnv("PKB_PORTAL_API_KEY")) envKeysPresent.push("PKB_PORTAL_API_KEY");
  if (readEnv("PKB_PORTAL_API_BASE_URL")) {
    envKeysPresent.push("PKB_PORTAL_API_BASE_URL");
  }
  return {
    tokenConfigured: Boolean(getPkbPortalToken()),
    tokenHadBearerPrefix: Boolean(raw && /^Bearer\s+/i.test(raw.trim())),
    envKeysPresent,
    baseUrl: getPkbPortalBaseUrl(),
  };
}

/** Absolute URL SIMSDM (server-side fetch / debug). */
export function buildSimsdmFotoUrl(
  foto: string | null | undefined,
): string | null {
  const file = foto?.trim();
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  return `${getSimsdmFotoBaseUrl()}/${file.replace(/^\//, "")}`;
}

/**
 * URL foto untuk browser — always same-origin proxy agar tidak kena
 * hotlink / CORS / timeout egress browser → SIMSDM.
 */
export function buildPkbFotoProxyUrl(
  foto: string | null | undefined,
): string | null {
  const file = foto?.trim();
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) {
    return `/api/pkb/foto?url=${encodeURIComponent(file)}`;
  }
  return `/api/pkb/foto?file=${encodeURIComponent(file.replace(/^\//, ""))}`;
}

/** Aset stub lokal (public/) — dipakai tanpa token. */
export const PKB_STUB_FOTO_PATH = "/pkb-stub-avatar.svg";

/** Stub hasil portal untuk NIP/KTP demo — dipakai tanpa token atau saat smoke. */
export function getPkbPortalStub(
  lookup: PkbPortalLookupKey | string,
): PkbPortalRecord | null {
  const key =
    typeof lookup === "string"
      ? resolvePortalLookupKey(lookup)
      : lookup;
  if (!key) return null;
  const hit =
    (key.kind === "nip" && key.value === PKB_PORTAL_DEMO_NIP) ||
    (key.kind === "ktp" && key.value === PKB_PORTAL_DEMO_KTP);
  if (!hit) return null;
  return {
    NIP: PKB_PORTAL_DEMO_NIP,
    ktp: PKB_PORTAL_DEMO_KTP,
    nama: "Ni Luh Putu Suryani",
    nohp: "081234567890",
    jenispegawai: "PNS",
    statuspegawai: "PKB",
    // Nama file contoh — UI stub memakai aset lokal; live pakai proxy SIMSDM.
    foto: "196803291988032003.jpg",
    lokasi_propinsi: "BALI",
    lokasi_kabupaten: "KOTA DENPASAR",
    lokasi_kecamatan: "DENPASAR SELATAN",
    lokasi_kelurahan: "SANUR",
    email_dinas: "suryani@bkkbn.go.id",
    jab_akhir: "PKB Madya",
    pelatihanLabels: ["Orientasi PKB", "Diklat teknis Madya"],
  };
}

function collectPelatihanLabels(row: Record<string, unknown>): string[] {
  const labels: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      for (const item of v) push(item);
      return;
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const label =
        obj.nama ?? obj.name ?? obj.label ?? obj.pelatihan ?? obj.diklat;
      if (label != null) push(label);
      return;
    }
    const s = String(v).trim();
    if (s && !labels.includes(s)) labels.push(s);
  };
  for (const key of [
    "pelatihan",
    "pelatihan_tbl",
    "diklat",
    "sertifikasi",
    "sertifikat",
    "pendidikan",
    "orientasi",
    "riwayat_pelatihan",
    "pelatihanLabels",
  ]) {
    push(row[key]);
  }
  return labels;
}

function normalizeRecord(raw: unknown): PkbPortalRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const nipRaw = row.NIP ?? row.nip;
  const nip =
    nipRaw == null
      ? ""
      : String(nipRaw).trim().replace(/\D/g, "") || String(nipRaw).trim();
  if (!nip) return null;
  const str = (key: string) => {
    const v = row[key];
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  };
  return {
    NIP: nip,
    ktp: str("ktp") ?? str("KTP") ?? str("nik") ?? str("NIK"),
    nama: str("nama") ?? nip,
    nohp: str("nohp") ?? str("no_hp"),
    jenispegawai: str("jenispegawai"),
    statuspegawai: str("statuspegawai"),
    foto: str("foto"),
    lokasi_propinsi: str("lokasi_propinsi"),
    lokasi_kabupaten: str("lokasi_kabupaten"),
    lokasi_kecamatan: str("lokasi_kecamatan"),
    lokasi_kelurahan: str("lokasi_kelurahan"),
    email_dinas: str("email_dinas"),
    jab_akhir: str("jab_akhir"),
    pelatihanLabels: collectPelatihanLabels(row),
  };
}

function digitsEqual(a: string, b: string): boolean {
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

function pickMatchingRecord(
  payload: unknown,
  lookup: PkbPortalLookupKey,
): PkbPortalRecord | null {
  const matchRec = (rec: PkbPortalRecord | null): PkbPortalRecord | null => {
    if (!rec) return null;
    if (lookup.kind === "nip" && digitsEqual(rec.NIP, lookup.value)) return rec;
    if (
      lookup.kind === "ktp" &&
      rec.ktp &&
      digitsEqual(rec.ktp, lookup.value)
    ) {
      return rec;
    }
    return null;
  };

  if (Array.isArray(payload)) {
    if (payload.length === 0) return null;
    for (const item of payload) {
      const hit = matchRec(normalizeRecord(item));
      if (hit) return hit;
    }
    // Query by ktp: terima record pertama yang punya NIP (filter sudah di query).
    if (lookup.kind === "ktp") {
      for (const item of payload) {
        const rec = normalizeRecord(item);
        if (rec) return rec;
      }
    }
    if (payload.length === 1) return normalizeRecord(payload[0]);
    return null;
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return pickMatchingRecord(obj.data, lookup);
    if (Array.isArray(obj.result)) return pickMatchingRecord(obj.result, lookup);
    if (Array.isArray(obj.items)) return pickMatchingRecord(obj.items, lookup);
    if (Array.isArray(obj.rows)) return pickMatchingRecord(obj.rows, lookup);
    const rec = normalizeRecord(payload);
    return matchRec(rec) ?? (lookup.kind === "ktp" ? rec : null) ?? rec;
  }
  return null;
}

function toEnrichment(
  record: PkbPortalRecord,
  source: PkbPortalSource,
  error: string | null = null,
): PkbPortalEnrichment {
  const fotoUrl =
    source === "stub"
      ? PKB_STUB_FOTO_PATH
      : buildPkbFotoProxyUrl(record.foto);
  return {
    source,
    nip: record.NIP,
    nama: record.nama,
    nohp: record.nohp,
    emailDinas: record.email_dinas,
    jabAkhir: record.jab_akhir,
    statusPegawai: record.statuspegawai,
    jenisPegawai: record.jenispegawai,
    lokasiPropinsi: record.lokasi_propinsi,
    lokasiKabupaten: record.lokasi_kabupaten,
    lokasiKecamatan: record.lokasi_kecamatan,
    lokasiKelurahan: record.lokasi_kelurahan,
    fotoFile: record.foto,
    fotoUrl,
    pelatihanLabels: record.pelatihanLabels,
    error,
  };
}

export type PortalFetchAttempt = {
  label: string;
  /** URL lengkap upstream (query-only `/api/pkb?…`, tanpa path KTP). */
  upstreamUrl: string;
  httpStatus: number | null;
  ok: boolean;
  bodySnippet: string | null;
  recordFound: boolean;
  error: string | null;
};

export type FetchPkbPortalReason =
  | "ok"
  | "invalid_lookup"
  | "token_missing"
  | "portal_http_error"
  | "portal_empty"
  | "portal_unreachable";

export type FetchPkbPortalResult = {
  enrichment: PkbPortalEnrichment | null;
  httpStatus: number | null;
  reason: FetchPkbPortalReason;
  attempts: PortalFetchAttempt[];
};

function snippetBody(body: unknown, max = 400): string {
  try {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return "[unserializable]";
  }
}

function isEmptyPayload(body: unknown): boolean {
  if (body == null) return true;
  if (Array.isArray(body)) return body.length === 0;
  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["data", "result", "items", "rows"]) {
      if (Array.isArray(obj[key])) return (obj[key] as unknown[]).length === 0;
    }
  }
  return false;
}

type QueryBuild = { label: string; params: URLSearchParams };

/**
 * Susun percobaan query portal — selalu `BASE/api/pkb?…` (bukan path segment).
 * Urutan: minimal Fajar (ktp+kec+kel) → ktp saja → +propinsi → +statuspegawai.
 */
function buildPortalQueryAttempts(
  lookup: PkbPortalLookupKey,
  lokasi: PkbPortalLokasi,
): QueryBuild[] {
  const names = resolvePortalLokasiNames({
    propinsi: lokasi.propinsi,
    kabupaten: lokasi.kabupaten,
    kecamatan: lokasi.kecamatan,
    kelurahan: lokasi.kelurahan,
  });
  const idParam = lookup.kind === "ktp" ? "ktp" : "NIP";
  const withId = () => {
    const p = new URLSearchParams();
    p.set(idParam, lookup.value);
    return p;
  };

  const attempts: QueryBuild[] = [];

  // 1) Bentuk yang Fajar konfirmasi bekerja: ktp + kecamatan + kelurahan
  if (lookup.kind === "ktp" && (names.kecamatan || names.kelurahan)) {
    const p = withId();
    if (names.kecamatan) p.set("lokasi_kecamatan", names.kecamatan);
    if (names.kelurahan) p.set("lokasi_kelurahan", names.kelurahan);
    attempts.push({ label: "ktp+kec+kel", params: p });
  }

  // 2) Hanya identitas
  attempts.push({ label: `${lookup.kind}-only`, params: withId() });

  // 3) + propinsi/kabupaten nama (tanpa statuspegawai)
  if (names.propinsi || names.kabupaten || names.kecamatan || names.kelurahan) {
    const p = withId();
    if (names.propinsi) p.set("lokasi_propinsi", names.propinsi);
    if (names.kabupaten) p.set("lokasi_kabupaten", names.kabupaten);
    if (names.kecamatan) p.set("lokasi_kecamatan", names.kecamatan);
    if (names.kelurahan) p.set("lokasi_kelurahan", names.kelurahan);
    attempts.push({ label: "id+lokasi-names", params: p });
  }

  // 4) Full + statuspegawai hanya jika caller kirim eksplisit (bisa over-filter)
  const status = lokasi.statuspegawai?.trim();
  if (status) {
    const p = withId();
    if (names.propinsi) p.set("lokasi_propinsi", names.propinsi);
    if (names.kabupaten) p.set("lokasi_kabupaten", names.kabupaten);
    if (names.kecamatan) p.set("lokasi_kecamatan", names.kecamatan);
    if (names.kelurahan) p.set("lokasi_kelurahan", names.kelurahan);
    p.set("statuspegawai", status.toUpperCase());
    attempts.push({ label: "id+lokasi+statuspegawai", params: p });
  }

  // Dedup by query string
  const seen = new Set<string>();
  return attempts.filter((a) => {
    const key = a.params.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Ambil detail PKB dari portal UAT.
 * Upstream SELALU: `{base}/api/pkb?ktp=…` atau `?NIP=…` — bukan `/api/pkb/{ktp}`.
 * Tanpa token → stub (NIP/KTP demo) atau reason `token_missing`.
 */
export async function fetchPkbFromPortal(
  lookupInput: PkbPortalLookupKey | string,
  lokasi: PkbPortalLokasi = { propinsi: "", kabupaten: "" },
  init?: { signal?: AbortSignal },
): Promise<FetchPkbPortalResult> {
  const lookup =
    typeof lookupInput === "string"
      ? resolvePortalLookupKey(lookupInput)
      : lookupInput;
  if (!lookup) {
    return {
      enrichment: null,
      httpStatus: null,
      reason: "invalid_lookup",
      attempts: [],
    };
  }

  const token = getPkbPortalToken();
  if (!token) {
    const stub = getPkbPortalStub(lookup);
    if (stub) {
      return {
        enrichment: toEnrichment(
          stub,
          "stub",
          "PKB_PORTAL_API_TOKEN belum di-set — stub demo",
        ),
        httpStatus: null,
        reason: "token_missing",
        attempts: [],
      };
    }
    return {
      enrichment: null,
      httpStatus: null,
      reason: "token_missing",
      attempts: [],
    };
  }

  const base = getPkbPortalBaseUrl();
  const queries = buildPortalQueryAttempts(lookup, lokasi);
  const attempts: PortalFetchAttempt[] = [];
  let lastHttp: number | null = null;
  let sawHttpError = false;
  let sawEmpty = false;
  let lastNetworkError: string | null = null;

  for (const q of queries) {
    // WAJIB query-string only — jangan ever append KTP sebagai path segment.
    const upstreamUrl = `${base}/api/pkb?${q.params.toString()}`;
    try {
      const response = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: init?.signal,
      });
      lastHttp = response.status;
      const rawText = await response.text();
      let body: unknown = rawText;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        /* keep text */
      }
      const bodySnippet = snippetBody(body);

      if (!response.ok) {
        sawHttpError = true;
        attempts.push({
          label: q.label,
          upstreamUrl,
          httpStatus: response.status,
          ok: false,
          bodySnippet,
          recordFound: false,
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      if (isEmptyPayload(body)) {
        sawEmpty = true;
        attempts.push({
          label: q.label,
          upstreamUrl,
          httpStatus: response.status,
          ok: true,
          bodySnippet,
          recordFound: false,
          error: "empty_payload",
        });
        continue;
      }

      const record = pickMatchingRecord(body, lookup);
      if (!record) {
        sawEmpty = true;
        attempts.push({
          label: q.label,
          upstreamUrl,
          httpStatus: response.status,
          ok: true,
          bodySnippet,
          recordFound: false,
          error: "unparseable_or_no_match",
        });
        continue;
      }

      attempts.push({
        label: q.label,
        upstreamUrl,
        httpStatus: response.status,
        ok: true,
        bodySnippet,
        recordFound: true,
        error: null,
      });
      return {
        enrichment: toEnrichment(record, "portal"),
        httpStatus: response.status,
        reason: "ok",
        attempts,
      };
    } catch (err) {
      lastNetworkError =
        err instanceof Error ? err.message : "Portal unreachable";
      attempts.push({
        label: q.label,
        upstreamUrl,
        httpStatus: null,
        ok: false,
        bodySnippet: null,
        recordFound: false,
        error: lastNetworkError,
      });
    }
  }

  const stub = getPkbPortalStub(lookup);
  if (stub) {
    const hint = attempts
      .map((a) => `${a.label}:${a.httpStatus ?? "net"}`)
      .join(", ");
    return {
      enrichment: toEnrichment(
        stub,
        "stub",
        `Portal gagal/kosong (${hint}) — stub demo`,
      ),
      httpStatus: lastHttp,
      reason: sawEmpty
        ? "portal_empty"
        : sawHttpError
          ? "portal_http_error"
          : "portal_unreachable",
      attempts,
    };
  }

  if (lastNetworkError && attempts.every((a) => a.httpStatus == null)) {
    return {
      enrichment: null,
      httpStatus: null,
      reason: "portal_unreachable",
      attempts,
    };
  }
  if (sawEmpty && !sawHttpError) {
    return {
      enrichment: null,
      httpStatus: lastHttp,
      reason: "portal_empty",
      attempts,
    };
  }
  return {
    enrichment: null,
    httpStatus: lastHttp,
    reason: sawHttpError ? "portal_http_error" : "portal_empty",
    attempts,
  };
}
