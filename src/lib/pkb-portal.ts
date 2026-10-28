/**
 * Integrasi API Portal PKB (UAT) + foto SIMSDM.
 * Server-side only — jangan import dari client component.
 *
 * Auth: set PKB_PORTAL_API_TOKEN (Bearer). Tanpa token → stub/fallback lokal.
 * Agregat jumlah PKB tidak diubah di sini.
 */

export type PkbPortalRecord = {
  NIP: string;
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
  propinsi: string;
  kabupaten: string;
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

/**
 * Kunci NIP untuk query portal.
 * Ambil digit dari PKBID/nip lokal; NIP PNS biasanya 15–18 digit.
 */
export function resolvePortalLookupNip(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    if (/^\d{8,25}$/.test(value)) return value;
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 25) return digits;
  }
  return null;
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

/** Stub hasil portal untuk NIP demo — dipakai tanpa token atau saat smoke. */
export function getPkbPortalStub(
  nip: string,
): PkbPortalRecord | null {
  if (nip !== PKB_PORTAL_DEMO_NIP) return null;
  return {
    NIP: PKB_PORTAL_DEMO_NIP,
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

function nipDigitsEqual(a: string, b: string): boolean {
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

function pickMatchingRecord(
  payload: unknown,
  nip: string,
): PkbPortalRecord | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const rec = normalizeRecord(item);
      if (rec && nipDigitsEqual(rec.NIP, nip)) return rec;
    }
    // Satu-satunya elemen array → terima meski field NIP sedikit berbeda format
    if (payload.length === 1) return normalizeRecord(payload[0]);
    return null;
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return pickMatchingRecord(obj.data, nip);
    if (Array.isArray(obj.result)) return pickMatchingRecord(obj.result, nip);
    if (Array.isArray(obj.items)) return pickMatchingRecord(obj.items, nip);
    const rec = normalizeRecord(payload);
    if (rec && nipDigitsEqual(rec.NIP, nip)) return rec;
    // Object tunggal tanpa array wrapper — terima bila ada NIP
    return rec;
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
 * Ambil detail PKB by NIP dari portal UAT.
 * Tanpa token → stub (jika NIP demo) atau null (pemanggil pakai fallback lokal).
 */
export async function fetchPkbFromPortal(
  nip: string,
  lokasi: PkbPortalLokasi,
  init?: { signal?: AbortSignal },
): Promise<FetchPkbPortalResult> {
  const cleanNip = resolvePortalLookupNip(nip);
  if (!cleanNip) {
    return { enrichment: null, httpStatus: null };
  }

  const token = getPkbPortalToken();
  if (!token) {
    const stub = getPkbPortalStub(cleanNip);
    if (stub) {
      return {
        enrichment: toEnrichment(stub, "stub", "PKB_PORTAL_API_TOKEN belum di-set — stub demo"),
        httpStatus: null,
      };
    }
    return { enrichment: null, httpStatus: null };
  }

  const params = new URLSearchParams();
  params.set("NIP", cleanNip);
  const propinsi = lokasi.propinsi?.trim().toUpperCase() || "";
  const kabupaten = lokasi.kabupaten?.trim().toUpperCase() || "";
  if (propinsi) params.set("lokasi_propinsi", propinsi);
  if (kabupaten) params.set("lokasi_kabupaten", kabupaten);
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
        // token sudah di-strip dari prefix "Bearer " bila ada di .env
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: init?.signal,
    });

    if (!response.ok) {
      let detail = `Portal HTTP ${response.status}`;
      try {
        const errBody = (await response.json()) as { error?: string; message?: string };
        if (errBody?.message) detail = `${detail}: ${errBody.message}`;
        else if (errBody?.error) detail = `${detail}: ${errBody.error}`;
      } catch {
        /* ignore */
      }
      const stub = getPkbPortalStub(cleanNip);
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
    const record = pickMatchingRecord(body, cleanNip);
    if (!record) {
      // Response 200 tapi shape tidak dikenali / NIP tidak cocok
      const stub = getPkbPortalStub(cleanNip);
      if (stub) {
        return {
          enrichment: toEnrichment(
            stub,
            "stub",
            "Portal 200 tapi NIP/record tidak ter-parse — stub demo",
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
    const stub = getPkbPortalStub(cleanNip);
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
