import { DEFAULT_CACHE_TTL_SEC } from "@/lib/data/cache";
import { getTpkDetailMock } from "@/lib/data/mock/tpk-detail";
import { PostgresDataError } from "@/lib/data/postgres/errors";
import {
  getDwhPeriode,
  getPoolConfigs,
  queryPool,
} from "@/lib/data/postgres/pools";
import {
  getKelurahanRekapMap,
  isSigaConfigured,
  SQL_PKB_BY_KELURAHAN,
  type KelurahanRekap,
} from "@/lib/data/postgres/tpk-list";
import type {
  TpkDetailAnggota,
  TpkDetailKomposisiPrioritas,
  TpkDetailPayload,
  TpkListIndikator,
  TpkListPkb,
} from "@/lib/data/types";
import { formatTpkDisplayName } from "@/lib/tpk-display-name";

type SigaTpkRow = {
  tpkid: string;
  namatpk: string | null;
  nomorregister: string | null;
  kodetpk: string | null;
  alamat: string | null;
  provinsiid: number | null;
  kabupatenid: number | null;
  kecamatanid: number | null;
  kelurahanid: number | null;
  status: number | null;
};

type AnggotaDetailRow = {
  nomor_urut: number | null;
  nama: string | null;
  nik: string | null;
  nohp: string | null;
  status_tpk: number | null;
  status_tbl: string | null;
  pelatihan: number | null;
  pelatihan_tbl: string | null;
  belum_dilatih: number | null;
};

type PkbJoinRow = {
  kelurahanid: number;
  pkbid: string;
  nama: string | null;
  nik: string | null;
  nohp: string | null;
  jabatan_tipe: number | null;
  jabatan_pkb: string | null;
  jabatan_plkb: string | null;
};

type NamaProvRow = { id_provinsi: number; nama_provinsi: string };
type NamaKabRow = { id_kabupaten: number; nama_kabupaten: string };
type NamaKecRow = { id_kecamatan: number; nama_kecamatan: string };
type NamaKelRow = { id_kelurahan: number; nama_kelurahan: string };

type KelurahanPrioritasRow = {
  prioritas_1: string | number;
  prioritas_2: string | number;
  prioritas_3: string | number;
  prioritas_4: string | number;
  bukan_prioritas: string | number;
  tidak_risiko: string | number;
};

type CountRow = { n: string | number };

function toInt(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Satu baris TPK by ID — DISTINCT ON TPKID (bukan PK formal). */
export const SQL_TPK_BY_ID = `
SELECT DISTINCT ON (t."TPKID")
  t."TPKID" AS tpkid,
  t."NamaTPK" AS namatpk,
  t."NomorRegister" AS nomorregister,
  t."KodeTPK" AS kodetpk,
  t."Alamat" AS alamat,
  t."ProvinsiID" AS provinsiid,
  t."KabupatenID" AS kabupatenid,
  t."KecamatanID" AS kecamatanid,
  t."KelurahanID" AS kelurahanid,
  t."Status" AS status
FROM "sigabaru"."dat_TPK" t
WHERE t."TPKID" = $1
ORDER BY
  t."TPKID",
  t."LastModified" DESC NULLS LAST,
  t."NomorRegister" ASC NULLS LAST
`;

export const SQL_ANGGOTA_DETAIL = `
SELECT
  a."NomorUrut" AS nomor_urut,
  NULLIF(TRIM(BOTH FROM a."Nama"), '') AS nama,
  NULLIF(TRIM(BOTH FROM a."NIK"), '') AS nik,
  NULLIF(TRIM(BOTH FROM a."NoHP"), '') AS nohp,
  a."StatusTPK" AS status_tpk,
  NULLIF(TRIM(BOTH FROM COALESCE(a."statustpk_tbl", '')), '') AS status_tbl,
  a."Pelatihan" AS pelatihan,
  NULLIF(TRIM(BOTH FROM COALESCE(a."pelatihan_tbl", '')), '') AS pelatihan_tbl,
  a."BelumDilatih" AS belum_dilatih
FROM "sigabaru"."dat_AnggotaTPK" a
WHERE a."TPKID" = $1
ORDER BY
  CASE
    WHEN a."StatusTPK" = 1 THEN 1
    WHEN a."StatusTPK" = 2 THEN 2
    WHEN a."StatusTPK" = 3 THEN 3
    ELSE 9
  END,
  a."NomorUrut" ASC NULLS LAST
`;

export const SQL_TPK_COUNT_SE_KELURAHAN = `
SELECT COUNT(DISTINCT t."TPKID")::int AS n
FROM "sigabaru"."dat_TPK" t
WHERE t."Status" = 1
  AND t."KelurahanID" = $1
`;

/** Prioritas grain RT digulung ke kelurahan — tanpa by_name. */
export const SQL_KELURAHAN_PRIORITAS = `
SELECT
  COALESCE(SUM(r."prioritas_1"), 0) AS prioritas_1,
  COALESCE(SUM(r."prioritas_2"), 0) AS prioritas_2,
  COALESCE(SUM(r."prioritas_3"), 0) AS prioritas_3,
  COALESCE(SUM(r."prioritas_4"), 0) AS prioritas_4,
  COALESCE(SUM(r."bukan_prioritas"), 0) AS bukan_prioritas,
  COALESCE(SUM(r."tidak_risiko_stunting"), 0) AS tidak_risiko
FROM "dwh_pk2025"."fs_stunting_by_rekap_rdk_pk25_semester1" r
WHERE r."periode" = $1
  AND r."id_kelurahan" = $2
`;

const ROLE_FALLBACK: Record<number, string> = {
  1: "Bidan",
  2: "PKK",
  3: "Kader KB",
};

function emptyIndikator(): TpkListIndikator {
  return {
    bumil: null,
    baduta: null,
    balita: null,
    jambanTL: null,
    airTL: null,
    rtlh: null,
  };
}

function indikatorFromRekap(rekap: KelurahanRekap | undefined): {
  keluargaSasaran: number | null;
  krs: number | null;
  indikator: TpkListIndikator;
} {
  if (!rekap) {
    return {
      keluargaSasaran: null,
      krs: null,
      indikator: emptyIndikator(),
    };
  }
  return {
    keluargaSasaran: rekap.keluargaSasaran,
    krs: rekap.krs,
    indikator: {
      bumil: rekap.bumil,
      baduta: rekap.baduta,
      balita: rekap.balita,
      jambanTL: rekap.jambanTL,
      airTL: rekap.airTL,
      rtlh: null,
    },
  };
}

function mapJabatan(
  tipe: number | null,
  jabatanPkb: string | null,
  jabatanPlkb: string | null,
): Pick<TpkListPkb, "jabatan" | "jabatanDetail"> {
  if (tipe === 1) return { jabatan: "PKB", jabatanDetail: jabatanPkb };
  if (tipe === 2) return { jabatan: "PLKB", jabatanDetail: jabatanPlkb };
  return { jabatan: null, jabatanDetail: jabatanPkb ?? jabatanPlkb };
}

function mapPkbRow(row: PkbJoinRow): TpkListPkb {
  const { jabatan, jabatanDetail } = mapJabatan(
    row.jabatan_tipe != null ? toInt(row.jabatan_tipe) : null,
    row.jabatan_pkb,
    row.jabatan_plkb,
  );
  const pkbId = row.pkbid?.trim() || "";
  return {
    pkbId,
    nip: pkbId || null,
    nama: row.nama?.trim() || null,
    jabatan,
    jabatanDetail,
    nik: row.nik?.trim() || null,
    noHp: row.nohp?.trim() || null,
  };
}

function mapPeran(statusTpk: number | null, statusTbl: string | null): string {
  const label = statusTbl?.trim();
  if (label) return label;
  if (statusTpk != null && ROLE_FALLBACK[statusTpk]) {
    return ROLE_FALLBACK[statusTpk]!;
  }
  return "Lainnya";
}

function mapAnggota(rows: AnggotaDetailRow[]): TpkDetailAnggota[] {
  const out: TpkDetailAnggota[] = [];
  for (const row of rows) {
    const nama = row.nama?.trim();
    if (!nama) continue;
    const statusTpk = row.status_tpk != null ? toInt(row.status_tpk) : null;
    const belum = row.belum_dilatih != null ? toInt(row.belum_dilatih) : null;
    const pelatihan = row.pelatihan != null ? toInt(row.pelatihan) : null;
    const terlatih = belum !== 1 && (pelatihan != null || Boolean(row.pelatihan_tbl));
    out.push({
      nomorUrut: row.nomor_urut != null ? toInt(row.nomor_urut) : null,
      nama,
      nik: row.nik?.trim() || null,
      noHp: row.nohp?.trim() || null,
      statusTpk,
      peran: mapPeran(statusTpk, row.status_tbl),
      pelatihanLabel: row.pelatihan_tbl?.trim() || null,
      terlatih,
    });
  }
  return out;
}

async function lookupWilayahNames(row: SigaTpkRow): Promise<{
  namaProvinsi: string | null;
  namaKabupaten: string | null;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
}> {
  const empty = {
    namaProvinsi: null as string | null,
    namaKabupaten: null as string | null,
    namaKecamatan: null as string | null,
    namaKelurahan: null as string | null,
  };
  if (!getPoolConfigs().wilayah.ready) return empty;

  const lookups: Promise<void>[] = [];
  const result = { ...empty };

  if (row.provinsiid != null) {
    const id = toInt(row.provinsiid);
    lookups.push(
      queryPool<NamaProvRow>(
        "wilayah",
        `SELECT p."id_provinsi", p."nama_provinsi"
         FROM "pk2025"."v_provinsi" p
         WHERE p."id_provinsi" = $1`,
        [id],
      ).then((res) => {
        result.namaProvinsi = res.rows[0]?.nama_provinsi?.trim() || null;
      }),
    );
  }
  if (row.kabupatenid != null) {
    const id = toInt(row.kabupatenid);
    lookups.push(
      queryPool<NamaKabRow>(
        "wilayah",
        `SELECT k."id_kabupaten", k."nama_kabupaten"
         FROM "pk2025"."v_kabupaten" k
         WHERE k."id_kabupaten" = $1`,
        [id],
      ).then((res) => {
        result.namaKabupaten = res.rows[0]?.nama_kabupaten?.trim() || null;
      }),
    );
  }
  if (row.kecamatanid != null) {
    const id = toInt(row.kecamatanid);
    lookups.push(
      queryPool<NamaKecRow>(
        "wilayah",
        `SELECT k."id_kecamatan", k."nama_kecamatan"
         FROM "pk2025"."v_kecamatan" k
         WHERE k."id_kecamatan" = $1`,
        [id],
      ).then((res) => {
        result.namaKecamatan = res.rows[0]?.nama_kecamatan?.trim() || null;
      }),
    );
  }
  if (row.kelurahanid != null) {
    const id = toInt(row.kelurahanid);
    lookups.push(
      queryPool<NamaKelRow>(
        "wilayah",
        `SELECT k."id_kelurahan", k."nama_kelurahan"
         FROM "pk2025"."v_kelurahan" k
         WHERE k."id_kelurahan" = $1`,
        [id],
      ).then((res) => {
        result.namaKelurahan = res.rows[0]?.nama_kelurahan?.trim() || null;
      }),
    );
  }

  try {
    await Promise.all(lookups);
  } catch (err) {
    console.warn("[tpk-detail] wilayah lookup gagal", err);
  }
  return result;
}

async function fetchPkbForKelurahan(
  kelurahanId: number,
): Promise<TpkListPkb | null> {
  try {
    const res = await queryPool<PkbJoinRow>("siga", SQL_PKB_BY_KELURAHAN, [
      [kelurahanId],
    ]);
    const row = res.rows[0];
    return row ? mapPkbRow(row) : null;
  } catch (err) {
    console.warn("[tpk-detail] PKB join gagal", err);
    return null;
  }
}

async function fetchPrioritas(
  kelurahanId: number,
): Promise<TpkDetailKomposisiPrioritas | null> {
  if (!getPoolConfigs().dwh.ready) return null;
  try {
    const periode = getDwhPeriode();
    const res = await queryPool<KelurahanPrioritasRow>(
      "dwh",
      SQL_KELURAHAN_PRIORITAS,
      [periode, kelurahanId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      prioritas1: toInt(row.prioritas_1),
      prioritas2: toInt(row.prioritas_2),
      prioritas3: toInt(row.prioritas_3),
      prioritas4: toInt(row.prioritas_4),
      bukan: toInt(row.bukan_prioritas),
      tidakRisiko: toInt(row.tidak_risiko),
    };
  } catch (err) {
    console.warn("[tpk-detail] prioritas rekap gagal", err);
    return null;
  }
}

async function fetchTpkSeDesa(kelurahanId: number): Promise<number> {
  try {
    const res = await queryPool<CountRow>("siga", SQL_TPK_COUNT_SE_KELURAHAN, [
      kelurahanId,
    ]);
    return Math.max(1, toInt(res.rows[0]?.n));
  } catch (err) {
    console.warn("[tpk-detail] tpkSeDesa gagal, default 1", err);
    return 1;
  }
}

/**
 * Detail TPK live — SIGA + wilayah + rollup by_rekap kelurahan.
 * Tidak scan by_name. Fallback mock hanya jika pool SIGA kosong.
 */
export async function getTpkDetailPostgres(
  tpkId: string,
): Promise<TpkDetailPayload | null> {
  if (!isSigaConfigured()) {
    return getTpkDetailMock(tpkId);
  }

  const id = tpkId.trim();
  if (!id) {
    throw new PostgresDataError("invalid_tpk_id", "TPKID tidak valid.", {
      status: 400,
    });
  }

  const tpkRes = await queryPool<SigaTpkRow>("siga", SQL_TPK_BY_ID, [id]);
  const row = tpkRes.rows[0];
  if (!row?.tpkid) return null;

  const kelId = row.kelurahanid != null ? toInt(row.kelurahanid) : null;
  const provId = row.provinsiid != null ? toInt(row.provinsiid) : null;
  const kabId = row.kabupatenid != null ? toInt(row.kabupatenid) : null;

  const [names, anggotaRes, pkb, rekapMap, komposisi, tpkSeDesa] =
    await Promise.all([
      lookupWilayahNames(row),
      queryPool<AnggotaDetailRow>("siga", SQL_ANGGOTA_DETAIL, [row.tpkid]).catch(
        (err) => {
          console.warn("[tpk-detail] anggota gagal", err);
          return { rows: [] as AnggotaDetailRow[] };
        },
      ),
      kelId != null ? fetchPkbForKelurahan(kelId) : Promise.resolve(null),
      getKelurahanRekapMap(provId, kabId, null, kelId),
      kelId != null ? fetchPrioritas(kelId) : Promise.resolve(null),
      kelId != null ? fetchTpkSeDesa(kelId) : Promise.resolve(1),
    ]);

  const rekap = kelId != null ? rekapMap.get(kelId) : undefined;
  const metrics = indikatorFromRekap(rekap);
  const status = row.status != null ? toInt(row.status) : null;

  const nama = formatTpkDisplayName({
    tpkId: row.tpkid,
    nama: names.namaKelurahan
      ? `TPK (${names.namaKelurahan})`
      : row.namatpk?.trim() || null,
    namaKelurahan: names.namaKelurahan,
    nomorRegister: row.nomorregister?.trim() || null,
  });

  return {
    tpkId: row.tpkid,
    nama,
    nomorRegister: row.nomorregister?.trim() || null,
    kodeTpk: row.kodetpk?.trim() || null,
    alamat: row.alamat?.trim() || null,
    status,
    statusLabel: status === 1 ? "Aktif" : status == null ? "—" : "Nonaktif",
    wilayah: {
      provinsiId: provId,
      kabupatenId: kabId,
      kecamatanId: row.kecamatanid != null ? toInt(row.kecamatanid) : null,
      kelurahanId: kelId,
      namaProvinsi: names.namaProvinsi,
      namaKabupaten: names.namaKabupaten,
      namaKecamatan: names.namaKecamatan,
      namaKelurahan: names.namaKelurahan,
    },
    anggota: mapAnggota(anggotaRes.rows),
    pkb,
    ...metrics,
    tpkSeDesa,
    komposisiPrioritas: komposisi,
    keluarga: [],
    meta: {
      cacheTtlSec: DEFAULT_CACHE_TTL_SEC,
      source: "postgres",
      generatedAt: new Date().toISOString(),
    },
  };
}
