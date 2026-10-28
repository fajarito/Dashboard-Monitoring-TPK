"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { LiveTpkKeluargaPanel } from "@/components/dashboard/live-tpk-keluarga-panel";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import {
  PhoneStatusHint,
  TpkContactAction,
} from "@/components/dashboard/tpk-contact-action";
import { TpkMemberCards } from "@/components/dashboard/tpk-member-cards";
import { TpkPrioritasDonut } from "@/components/dashboard/tpk-prioritas-donut";
import { Button } from "@/components/ui/button";
import type {
  TpkDetailAnggota,
  TpkDetailKomposisiPrioritas,
  TpkDetailPayload,
  TpkListPkb,
} from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { usePkbPortal } from "@/lib/hooks/use-pkb-portal";
import { useTpkDetail } from "@/lib/hooks/use-tpk-detail";
import { formatNumber } from "@/lib/map-data";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import {
  formatAgregatDesaCaption,
} from "@/lib/tpk-display-name";
import type { PrioritasSlice } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

const PRIORITAS_META: {
  id: PrioritasSlice["id"];
  key: keyof TpkDetailKomposisiPrioritas;
  label: string;
  color: string;
}[] = [
  { id: "p1", key: "prioritas1", label: "Prioritas 1", color: "#0b4dd8" },
  { id: "p2", key: "prioritas2", label: "Prioritas 2", color: "#155eef" },
  { id: "p3", key: "prioritas3", label: "Prioritas 3", color: "#3b82f6" },
  { id: "p4", key: "prioritas4", label: "Prioritas 4", color: "#93c5fd" },
  { id: "bukan", key: "bukan", label: "Bukan prioritas", color: "#94a3b8" },
  {
    id: "tidakRisiko",
    key: "tidakRisiko",
    label: "Tidak berisiko",
    color: "#86efac",
  },
];

function toMemberCards(anggota: TpkDetailAnggota[]) {
  return anggota.map((item, index) => ({
    id: `${item.nomorUrut ?? index + 1}-${item.nama}`,
    role: item.peran,
    name: item.nama,
    nik: item.nik ?? "—",
    phone: item.noHp,
    trainingStatus: item.terlatih
      ? ("Terlatih" as const)
      : ("Tidak Terlatih" as const),
  }));
}

function toPrioritasSlices(
  komposisi: TpkDetailKomposisiPrioritas | null,
): { total: number; slices: PrioritasSlice[] } | null {
  if (!komposisi) return null;
  const values = PRIORITAS_META.map((meta) => ({
    ...meta,
    value: komposisi[meta.key],
  }));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return { total: 0, slices: [] };
  const slices: PrioritasSlice[] = values.map((item) => ({
    id: item.id,
    label: item.label,
    share: item.value / total,
    color: item.color,
    value: item.value,
    percent: (item.value / total) * 100,
  }));
  return { total, slices };
}

function wilayahPath(payload: TpkDetailPayload): string {
  const parts: string[] = [];
  const w = payload.wilayah;
  if (w.namaKelurahan) parts.push(`Desa/Kel. ${w.namaKelurahan}`);
  if (w.namaKecamatan) parts.push(`Kec. ${w.namaKecamatan}`);
  if (w.namaKabupaten) parts.push(w.namaKabupaten);
  if (w.namaProvinsi) parts.push(w.namaProvinsi);
  return parts.join(", ");
}

function toTitleCaseLokasi(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (ch) => ch.toUpperCase());
}

/** Satu baris lokasi kerja: `Provinsi - Kab - Kec - Kel` (title case). */
function formatLokasiKerjaLine(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .map(toTitleCaseLokasi)
    .join(" - ");
}

function PkbFoto({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className="grid size-24 place-items-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80 sm:size-28"
        aria-hidden
      >
        <UserRound className="size-10" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- proxy same-origin / stub SVG
    <img
      src={src}
      alt={alt}
      width={112}
      height={112}
      className="size-24 rounded-2xl object-cover ring-1 ring-slate-200/80 sm:size-28"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function ProfileMeta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value?.trim()) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13px] font-semibold text-navy break-words",
          mono && "font-mono text-[12px] tracking-wide tabular-nums",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Profil profesional PKB/PLKB — satu composition (bukan nested cards).
 * NIP & field portal dari response; lokasi title-case; pelatihan dari portal
 * atau jenjang lokal (`jabatanDetail`).
 */
function PkbPembinaCard({
  pkb,
  lokasi,
}: {
  pkb: TpkListPkb | null;
  /** Nama wilayah dari payload TPK (bukan kode BPS). */
  lokasi: {
    propinsi: string | null;
    kabupaten: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
  };
}) {
  const portal = usePkbPortal(
    pkb ? { nip: pkb.nip, pkbId: pkb.pkbId, nik: pkb.nik } : null,
    {
      propinsi: lokasi.propinsi,
      kabupaten: lokasi.kabupaten,
      kecamatan: lokasi.kecamatan,
      kelurahan: lokasi.kelurahan,
    },
  );

  const d = portal.data;
  const portalReady = portal.status === "ready" && d != null;

  const displayNip = portalReady ? d.NIP || d.nip : null;
  const name = portalReady ? d.nama : pkb?.nama || null;
  const phone = portalReady ? d.nohp : pkb?.noHp || null;
  const jabAkhir = portalReady
    ? d.jab_akhir || d.jabAkhir
    : [pkb?.jabatan, pkb?.jabatanDetail].filter(Boolean).join(" · ") || null;
  const email = portalReady ? d.email_dinas || d.emailDinas : null;
  const jenisPegawai = portalReady
    ? d.jenispegawai || d.jenisPegawai
    : null;
  const statusPegawai = portalReady
    ? d.statuspegawai || d.statusPegawai
    : pkb?.jabatan || null;
  const badgeLabel = statusPegawai || pkb?.jabatan || "PKB";
  const fotoUrl = portalReady ? d.fotoUrl : null;

  const lokasiLine = formatLokasiKerjaLine([
    (portalReady ? d.lokasi_propinsi || d.lokasiPropinsi : null) ||
      lokasi.propinsi,
    (portalReady ? d.lokasi_kabupaten || d.lokasiKabupaten : null) ||
      lokasi.kabupaten,
    (portalReady ? d.lokasi_kecamatan || d.lokasiKecamatan : null) ||
      lokasi.kecamatan,
    (portalReady ? d.lokasi_kelurahan || d.lokasiKelurahan : null) ||
      lokasi.kelurahan,
  ]);

  const pelatihanItems: string[] = [];
  if (portalReady && Array.isArray(d.pelatihanLabels)) {
    for (const label of d.pelatihanLabels) {
      const s = label?.trim();
      if (s && !pelatihanItems.includes(s)) pelatihanItems.push(s);
    }
  }
  // Fallback lokal: jenjang jabatan (Terampil/Mahir/…) bila portal kosong.
  if (pelatihanItems.length === 0 && pkb?.jabatanDetail?.trim()) {
    pelatihanItems.push(`Jenjang ${pkb.jabatanDetail.trim()}`);
  }

  const source = d?.source ?? "fallback";
  const sourceLabel =
    source === "portal"
      ? "Portal"
      : source === "stub"
        ? "Stub"
        : portal.status === "loading"
          ? "Memuat…"
          : portal.status === "empty" &&
              portal.errorCode === "portal_token_missing"
            ? "Token belum terbaca"
            : portal.status === "empty"
              ? "Tidak ditemukan"
              : portal.status === "error"
                ? "Error"
                : "Lokal";

  const nipLine = displayNip
    ? `NIP ${displayNip}`
    : portal.status === "loading"
      ? "NIP …"
      : portal.errorCode === "portal_token_missing"
        ? "NIP — token belum terbaca"
        : portal.status === "empty"
          ? "NIP — tidak ditemukan di portal"
          : "NIP —";

  return (
    <section
      className="design-card p-6 sm:p-7"
      aria-label="Profil PKB atau PLKB pembina"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
          PKB / PLKB pembina
        </h2>
        <span
          className={cn(
            "text-[10px] font-extrabold tracking-wider uppercase",
            source === "portal"
              ? "text-emerald-700"
              : source === "stub"
                ? "text-amber-700"
                : "text-slate-500",
          )}
        >
          {sourceLabel}
        </span>
      </div>

      {!pkb || !name ? (
        <p className="border-t border-dashed border-line pt-6 text-center text-[12px] text-muted-foreground">
          PKB/PLKB desa binaan tidak ditemukan untuk kelurahan ini.
        </p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
          <div className="mx-auto shrink-0 sm:mx-0">
            <PkbFoto src={fotoUrl} alt={`Foto ${name}`} />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="text-base font-extrabold tracking-tight text-navy sm:text-lg">
                  {name}
                </h3>
                <span className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
                  {badgeLabel}
                </span>
              </div>
              <p className="mt-1 font-mono text-[12px] font-bold tracking-wide text-navy/80 tabular-nums">
                {nipLine}
              </p>
              {jabAkhir ? (
                <p className="mt-1.5 text-[13px] font-semibold text-slate-700">
                  {jabAkhir}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileMeta label="Jenis pegawai" value={jenisPegawai} />
              <ProfileMeta label="Status pegawai" value={statusPegawai} />
              <ProfileMeta label="Email dinas" value={email} />
              <ProfileMeta label="No. HP" value={phone} mono />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <PhoneStatusHint phone={phone} />
              <div className="flex shrink-0 items-center gap-1.5">
                <TpkContactAction phone={phone} kind="call" size="sm" />
                <TpkContactAction phone={phone} kind="whatsapp" size="sm" />
              </div>
            </div>

            <div className="border-t border-line pt-3">
              <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Lokasi kerja
              </div>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-navy">
                {lokasiLine || "Lokasi belum tersedia"}
              </p>
            </div>

            <div className="border-t border-line pt-3">
              <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase">
                Informasi terlatih
              </div>
              {pelatihanItems.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {pelatihanItems.map((item) => (
                    <li
                      key={item}
                      className="text-[13px] font-semibold text-navy"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Belum ada data pelatihan / jenjang.
                </p>
              )}
            </div>

            {d?.warning ? (
              <p className="text-[11px] text-amber-700">{d.warning}</p>
            ) : null}
            {portal.status === "empty" ? (
              <p className="text-[11px] text-slate-500">
                {portal.errorCode === "portal_token_missing"
                  ? portal.error ??
                    "Token belum terbaca — isi PKB_PORTAL_API_TOKEN di .env.local lalu restart next dev."
                  : portal.error ??
                    "Portal tidak menemukan PKB untuk KTP/NIP ini."}
              </p>
            ) : null}
            {portal.status === "error" && portal.error ? (
              <p className="text-[11px] text-slate-500">
                Portal gagal ({portal.error}) — menampilkan data lokal.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function DetailReady({
  provinceSlug,
  payload,
}: {
  provinceSlug: string;
  payload: TpkDetailPayload;
}) {
  const province = getProvinceOrNull(provinceSlug);
  const listHref = `/wilayah/${provinceSlug}/tpk`;
  const mapHref = `/?wilayah=prov-${provinceSlug}`;
  const sourceBadge = resolveSourceBadge(payload.meta.source);
  const agregatCaption = formatAgregatDesaCaption(payload.tpkSeDesa);
  const desaLabel =
    payload.wilayah.namaKelurahan?.trim() ||
    payload.nama.replace(/^TPK\s*\(/i, "").replace(/\).*$/, "") ||
    payload.nama;
  const prioritas = toPrioritasSlices(payload.komposisiPrioritas);
  const path = wilayahPath(payload);

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              {
                label: province?.name ?? payload.wilayah.namaProvinsi ?? "Wilayah",
                href: `/wilayah/${provinceSlug}`,
              },
              { label: "Daftar TPK", href: listHref },
              { label: payload.nama },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">{payload.nama}</h1>
            {sourceBadge ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
                  sourceBadge.className,
                )}
              >
                {sourceBadge.label}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
                payload.status === 1
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {payload.statusLabel}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {payload.tpkId}
            {path ? ` · ${path}` : ""}
            {payload.keluargaSasaran != null ? (
              <>
                {" · "}
                <span className="font-semibold text-navy">
                  {formatNumber(payload.keluargaSasaran)} keluarga sasaran
                </span>
              </>
            ) : null}
            {payload.krs != null ? (
              <>
                {" · "}
                <span className="font-semibold text-navy">
                  {formatNumber(payload.krs)} KRS
                </span>
              </>
            ) : null}
            {agregatCaption ? (
              <>
                {" · "}
                <span className="font-medium text-slate-500">{agregatCaption}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={listHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Daftar TPK
            </Link>
          </Button>
        </div>
      </div>

      <TpkMemberCards members={toMemberCards(payload.anggota)} />

      <PkbPembinaCard
        pkb={payload.pkb}
        lokasi={{
          propinsi: payload.wilayah.namaProvinsi,
          kabupaten: payload.wilayah.namaKabupaten,
          kecamatan: payload.wilayah.namaKecamatan,
          kelurahan: payload.wilayah.namaKelurahan,
        }}
      />

      <SasaranIndikatorPanel
        scopeLabel={desaLabel}
        counts={{
          ibuHamil: payload.indikator.bumil,
          baduta: payload.indikator.baduta,
          balita: payload.indikator.balita,
          jambanTidakLayak: payload.indikator.jambanTL,
          sumberAirTidakLayak: payload.indikator.airTL,
          rtlh: payload.indikator.rtlh,
        }}
        keluargaSasaran={payload.keluargaSasaran}
        krs={payload.krs}
        dataSource={payload.meta.source}
        caption={agregatCaption}
      />

      {prioritas && prioritas.slices.length > 0 ? (
        <TpkPrioritasDonut
          tpkName={payload.nama}
          total={prioritas.total}
          slices={prioritas.slices}
          dataSource={payload.meta.source}
          caption={agregatCaption}
        />
      ) : null}

      <LiveTpkKeluargaPanel tpkId={payload.tpkId} tpkName={payload.nama} />

      <p className="text-[11px] text-slate-400">
        Jejak:{" "}
        <Link href="/" className="font-semibold text-primary hover:underline">
          Peta
        </Link>{" "}
        →{" "}
        <Link
          href={mapHref}
          className="font-semibold text-primary hover:underline"
        >
          {province?.name ?? payload.wilayah.namaProvinsi ?? "Wilayah"}
        </Link>{" "}
        →{" "}
        <Link
          href={listHref}
          className="font-semibold text-primary hover:underline"
        >
          Daftar TPK
        </Link>{" "}
        → {payload.nama}
      </p>
    </section>
  );
}

export function LiveTpkDetailPanel({
  provinceSlug,
  tpkId,
}: {
  provinceSlug: string;
  tpkId: string;
}) {
  const detail = useTpkDetail(tpkId);
  const listHref = `/wilayah/${provinceSlug}/tpk`;
  const province = getProvinceOrNull(provinceSlug);

  if (detail.status === "loading" || detail.status === "idle") {
    return (
      <section className="animate-content-enter space-y-4">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            {
              label: province?.name ?? "Wilayah",
              href: `/wilayah/${provinceSlug}`,
            },
            { label: "Daftar TPK", href: listHref },
            { label: "Memuat…" },
          ]}
        />
        <div className="design-card overflow-hidden">
          <LoadingState label="Memuat detail TPK…" rows={6} />
        </div>
      </section>
    );
  }

  if (detail.status === "error") {
    return (
      <section className="animate-content-enter space-y-4">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            {
              label: province?.name ?? "Wilayah",
              href: `/wilayah/${provinceSlug}`,
            },
            { label: "Daftar TPK", href: listHref },
            { label: "Error" },
          ]}
        />
        <div className="design-card overflow-hidden">
          <ErrorState
            title="Gagal memuat detail TPK"
            description={detail.error ?? "Terjadi gangguan saat mengambil data."}
            onRetry={detail.refetch}
          />
        </div>
        <Button asChild variant="outline" className="h-10 gap-2 rounded-xl">
          <Link href={listHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke daftar
          </Link>
        </Button>
      </section>
    );
  }

  if (detail.status === "empty" || !detail.payload) {
    return (
      <section className="animate-content-enter space-y-4">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            {
              label: province?.name ?? "Wilayah",
              href: `/wilayah/${provinceSlug}`,
            },
            { label: "Daftar TPK", href: listHref },
            { label: "Tidak ditemukan" },
          ]}
        />
        <div className="design-card overflow-hidden">
          <EmptyState
            title="TPK tidak ditemukan"
            description={`Tidak ada data untuk TPKID ${tpkId}. Periksa tautan atau kembali ke daftar TPK.`}
            action={
              <Button asChild variant="outline" className="h-9 gap-2 rounded-xl">
                <Link href={listHref}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Daftar TPK
                </Link>
              </Button>
            }
          />
        </div>
      </section>
    );
  }

  return <DetailReady provinceSlug={provinceSlug} payload={detail.payload} />;
}
