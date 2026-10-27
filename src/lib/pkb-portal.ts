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
  nip: string;
  nama: string;
  nohp: string | null;
  emailDinas: string | null;
  jabAkhir: string | null;
  statusPegawai: string | null;
  jenisPegawai: string | null;
  fotoFile: string | null;
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

/** Token Bearer portal. Kosong = mode stub/fallback (aman untuk local). */
export function getPkbPortalToken(): string | null {
  return (
    readEnv("PKB_PORTAL_API_TOKEN") ??
    readEnv("PKB_PORTAL_API_KEY") ??
    null
  );
}

export function buildSimsdmFotoUrl(
  foto: string | null | undefined,
): string | null {
  const file = foto?.trim();
  if (!file) return null;
  if (/^https?:\/\//i.test(file)) return file;
  return `${getSimsdmFotoBaseUrl()}/${file.replace(/^\//, "")}`;
}

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
    foto: "foto_pkb_demo.jpg",
    lokasi_propinsi: "BALI",
    lokasi_kabupaten: "KOTA DENPASAR",
    lokasi_kecamatan: null,
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

function pickMatchingRecord(
  payload: unknown,
  nip: string,
): PkbPortalRecord | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const rec = normalizeRecord(item);
      if (rec && rec.NIP === nip) return rec;
    }
    const first = normalizeRecord(payload[0]);
    return first && first.NIP === nip ? first : first;
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return pickMatchingRecord(obj.data, nip);
    if (Array.isArray(obj.result)) return pickMatchingRecord(obj.result, nip);
    if (Array.isArray(obj.items)) return pickMatchingRecord(obj.items, nip);
    return normalizeRecord(payload);
  }
  return null;
}

function toEnrichment(
  record: PkbPortalRecord,
  source: PkbPortalSource,
  error: string | null = null,
): PkbPortalEnrichment {
  return {
    source,
    nip: record.NIP,
    nama: record.nama,
    nohp: record.nohp,
    emailDinas: record.email_dinas,
    jabAkhir: record.jab_akhir,
    statusPegawai: record.statuspegawai,
    jenisPegawai: record.jenispegawai,
    fotoFile: record.foto,
    fotoUrl: buildSimsdmFotoUrl(record.foto),
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
  const cleanNip = nip.trim();
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
  if (lokasi.propinsi) params.set("lokasi_propinsi", lokasi.propinsi);
  if (lokasi.kabupaten) params.set("lokasi_kabupaten", lokasi.kabupaten);
  params.set("statuspegawai", lokasi.statuspegawai?.trim() || "PKB");

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
      const stub = getPkbPortalStub(cleanNip);
      if (stub) {
        return {
          enrichment: toEnrichment(
            stub,
            "stub",
            `Portal HTTP ${response.status} — stub demo`,
          ),
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
