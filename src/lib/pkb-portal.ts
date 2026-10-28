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
  email_dinas: string | null;
  jab_akhir: string | null;
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
  fotoFile: string | null;
  /**
   * URL foto untuk <img>:
   * - portal → proxy same-origin `/api/pkb/foto?file=…` (hindari hotlink/CORS SIMSDM)
   * - stub → aset lokal
   */
  fotoUrl: string | null;
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
    email_dinas: "suryani@bkkbn.go.id",
    jab_akhir: "PKB Madya",
  };
}

function normalizeRecord(raw: unknown): PkbPortalRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const nip = String(row.NIP ?? row.nip ?? "").trim();
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
    email_dinas: str("email_dinas"),
    jab_akhir: str("jab_akhir"),
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
    for (const item of payload) {
      const hit = matchRec(normalizeRecord(item));
      if (hit) return hit;
    }
    // Query by ktp biasanya 1 record — terima elemen tunggal.
    if (payload.length === 1) return normalizeRecord(payload[0]);
    return null;
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return pickMatchingRecord(obj.data, lookup);
    if (Array.isArray(obj.result)) return pickMatchingRecord(obj.result, lookup);
    if (Array.isArray(obj.items)) return pickMatchingRecord(obj.items, lookup);
    const rec = normalizeRecord(payload);
    return matchRec(rec) ?? rec;
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
    fotoFile: record.foto,
    fotoUrl,
    error,
  };
}

export type FetchPkbPortalResult = {
  enrichment: PkbPortalEnrichment | null;
  httpStatus: number | null;
};

/**
 * Ambil detail PKB dari portal UAT.
 * - kind=nip → query `NIP=`
 * - kind=ktp → query `ktp=` (NIK 16 digit) — konfirmasi Fajar
 * Tanpa token → stub (NIP/KTP demo) atau null.
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
    return { enrichment: null, httpStatus: null };
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
      };
    }
    return { enrichment: null, httpStatus: null };
  }

  const params = new URLSearchParams();
  // Portal UAT: lookup by KTP pakai query lowercase `ktp` (bukan NIK/KTP).
  if (lookup.kind === "ktp") {
    params.set("ktp", lookup.value);
  } else {
    params.set("NIP", lookup.value);
  }
  // Filter lokasi = NAMA (UPPER), bukan kode wilayah — konfirmasi Fajar.
  const names = resolvePortalLokasiNames({
    propinsi: lokasi.propinsi,
    kabupaten: lokasi.kabupaten,
    kecamatan: lokasi.kecamatan,
    kelurahan: lokasi.kelurahan,
  });
  if (names.propinsi) params.set("lokasi_propinsi", names.propinsi);
  if (names.kabupaten) params.set("lokasi_kabupaten", names.kabupaten);
  if (names.kecamatan) params.set("lokasi_kecamatan", names.kecamatan);
  if (names.kelurahan) params.set("lokasi_kelurahan", names.kelurahan);
  params.set(
    "statuspegawai",
    (lokasi.statuspegawai?.trim() || "PKB").toUpperCase(),
  );

  const url = `${getPkbPortalBaseUrl()}/api/pkb?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: init?.signal,
    });

    if (!response.ok) {
      let detail = `Portal HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as {
          error?: string;
          message?: string;
        };
        if (errBody?.message) detail = `${detail}: ${errBody.message}`;
        else if (errBody?.error) detail = `${detail}: ${errBody.error}`;
      } catch {
        /* ignore */
      }
      const stub = getPkbPortalStub(lookup);
      if (stub) {
        return {
          enrichment: toEnrichment(stub, "stub", `${detail} — stub demo`),
          httpStatus: response.status,
        };
      }
      return {
        enrichment: null,
        httpStatus: response.status,
      };
    }

    const body: unknown = await response.json();
    const record = pickMatchingRecord(body, lookup);
    if (!record) {
      const stub = getPkbPortalStub(lookup);
      if (stub) {
        return {
          enrichment: toEnrichment(
            stub,
            "stub",
            "Portal 200 tapi record tidak ter-parse — stub demo",
          ),
          httpStatus: response.status,
        };
      }
      return { enrichment: null, httpStatus: response.status };
    }
    return {
      enrichment: toEnrichment(record, "portal"),
      httpStatus: response.status,
    };
  } catch (err) {
    const stub = getPkbPortalStub(lookup);
    if (stub) {
      return {
        enrichment: toEnrichment(
          stub,
          "stub",
          err instanceof Error ? err.message : "Portal unreachable — stub",
        ),
        httpStatus: null,
      };
    }
    return { enrichment: null, httpStatus: null };
  }
}
