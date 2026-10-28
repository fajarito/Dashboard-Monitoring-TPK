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
        className="grid size-[88px] place-items-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100"
        aria-hidden
      >
        <UserRound className="size-9" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- proxy same-origin / stub SVG
    <img
      src={src}
      alt={alt}
      width={88}
      height={88}
      className="size-[88px] rounded-2xl object-cover ring-1 ring-slate-200"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function PortalField({
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
    <div className="min-w-[9rem] flex-1">
      <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
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
 * Kartu pembina — prioritas tampilan = field API portal.
 * NIP = `portal.NIP` (bukan NIK KTP / bukan label lokal).
 */
function PkbPembinaCard({
  pkb,
  lokasi,
}: {
  pkb: TpkListPkb | null;
  lokasi: {
    propinsi: string | null;
    kabupaten: string | null;
  };
}) {
  // Kunci pencarian ke portal: pkb.nip (SIGA) lalu pkbId.
  // Tanpa digit 8–25 → hook idle, tidak pernah hit /api/pkb.
  const lookupKey = pkb?.nip?.trim() || pkb?.pkbId?.trim() || null;
  const portal = usePkbPortal(lookupKey, {
    propinsi: lokasi.propinsi,
    kabupaten: lokasi.kabupaten,
    // Filter portal = statuspegawai (PKB/PLKB), BUKAN jab_akhir/jabatan lokal.
    statuspegawai: "PKB",
  });

  const d = portal.data;
  const portalReady = portal.status === "ready" && d != null;

  // NIP tampilan: HANYA dari response portal. Jangan pakai NIK / lookupKey lokal.
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
  const lokasiPropinsi = portalReady
    ? d.lokasi_propinsi || d.lokasiPropinsi
    : null;
  const lokasiKabupaten = portalReady
    ? d.lokasi_kabupaten || d.lokasiKabupaten
    : null;
  const lokasiKecamatan = portalReady
    ? d.lokasi_kecamatan || d.lokasiKecamatan
    : null;
  const fotoUrl = portalReady ? d.fotoUrl : null;
  const fotoFile = portalReady ? d.foto || d.fotoFile : null;

  const source = d?.source ?? "fallback";
  const sourceLabel =
    source === "portal"
      ? "Portal UAT"
      : source === "stub"
        ? "Stub portal"
        : portal.status === "loading"
          ? "Memuat portal…"
          : portal.status === "idle" && portal.error
            ? "Lookup NIP kosong"
            : portal.status === "empty"
              ? "Portal kosong"
              : portal.status === "error"
                ? "Portal error"
                : "Data lokal";

  const nipStatusLine = (() => {
    if (displayNip) return `NIP ${displayNip}`;
    if (portal.status === "loading") return "NIP … memuat portal";
    if (portal.status === "idle" && !lookupKey) {
      return "NIP — (tidak ada nip/pkbId di data TPK lokal)";
    }
    if (portal.status === "idle" && portal.error) {
      return `NIP — (${portal.error})`;
    }
    if (portal.status === "empty") {
      return "NIP — (portal: tidak ditemukan / token belum terbaca)";
    }
    if (portal.status === "error") {
      return `NIP — (portal gagal: ${portal.error ?? "error"})`;
    }
    return "NIP — (data lokal, portal belum siap)";
  })();

  return (
    <section className="design-card p-6 sm:p-7" aria-label="PKB atau PLKB pembina">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            PKB / PLKB pembina
          </h2>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Field dari API portal (NIP, jabatan, lokasi, email, foto SIMSDM) —
            bukan NIK KTP
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
            source === "portal"
              ? "bg-emerald-50 text-emerald-700"
              : source === "stub"
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {sourceLabel}
        </span>
      </div>

      {!pkb || !name ? (
        <p className="rounded-2xl border border-dashed border-line bg-slate-50/80 px-4 py-8 text-center text-[12px] text-muted-foreground">
          PKB/PLKB desa binaan tidak ditemukan untuk kelurahan ini.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#d0dae8] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-slate-100/80 sm:flex-row sm:items-start sm:px-5 sm:py-5">
          <div className="mx-auto shrink-0 sm:mx-0">
            <PkbFoto src={fotoUrl} alt={name ? `Foto ${name}` : "Foto PKB"} />
            {fotoFile ? (
              <p className="mt-1.5 max-w-[88px] truncate text-center text-[9px] text-slate-400">
                {fotoFile}
              </p>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-extrabold text-navy">{name}</span>
                {statusPegawai ? (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-violet-700 uppercase">
                    {statusPegawai}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 font-mono text-[12px] font-bold tracking-wide text-navy tabular-nums">
                {nipStatusLine}
              </div>
              {lookupKey && !displayNip ? (
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Lookup key:{" "}
                  <span className="font-mono">{lookupKey}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-3">
              <PortalField label="Jabatan akhir" value={jabAkhir} />
              <PortalField label="Jenis pegawai" value={jenisPegawai} />
              <PortalField label="Status pegawai" value={statusPegawai} />
              <PortalField label="Email dinas" value={email} />
              <PortalField label="No. HP" value={phone} mono />
              <PortalField label="Lokasi provinsi" value={lokasiPropinsi} />
              <PortalField label="Lokasi kabupaten" value={lokasiKabupaten} />
              <PortalField label="Lokasi kecamatan" value={lokasiKecamatan} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <PhoneStatusHint phone={phone} />
              <div className="flex shrink-0 items-center gap-1.5">
                <TpkContactAction phone={phone} kind="call" size="sm" />
                <TpkContactAction phone={phone} kind="whatsapp" size="sm" />
              </div>
            </div>

            {d?.warning ? (
              <p className="text-[11px] text-amber-700">{d.warning}</p>
            ) : null}
            {portal.status === "empty" ? (
              <p className="text-[11px] text-slate-500">
                {portal.error ??
                  "Portal tidak mengembalikan PKB untuk lookup ini. Cek PKB_PORTAL_API_TOKEN + restart next dev, atau /api/pkb/…?diag=1."}
              </p>
            ) : null}
            {portal.status === "error" && portal.error ? (
              <p className="text-[11px] text-slate-500">
                Portal gagal ({portal.error}) — menampilkan data lokal (tanpa
                NIK).
              </p>
            ) : null}
            {portal.status === "idle" && portal.error ? (
              <p className="text-[11px] text-slate-500">{portal.error}</p>
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
