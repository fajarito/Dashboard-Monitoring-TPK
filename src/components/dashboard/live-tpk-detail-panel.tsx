"use client";

import Link from "next/link";
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

function PkbPembinaCard({ pkb }: { pkb: TpkListPkb | null }) {
  return (
    <section className="design-card p-6 sm:p-7" aria-label="PKB atau PLKB pembina">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            PKB / PLKB pembina
          </h2>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            Tenaga supervisi desa binaan (Status aktif)
          </p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"
          aria-hidden
        >
          <UserRound className="size-4" />
        </span>
      </div>

      {!pkb || !pkb.nama ? (
        <p className="rounded-2xl border border-dashed border-line bg-slate-50/80 px-4 py-8 text-center text-[12px] text-muted-foreground">
          PKB/PLKB desa binaan tidak ditemukan untuk kelurahan ini.
        </p>
      ) : (
        <div className="rounded-2xl border border-[#d0dae8] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-slate-100/80 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-extrabold text-navy">
                  {pkb.nama}
                </span>
                {pkb.jabatan ? (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-violet-700 uppercase">
                    {pkb.jabatan}
                  </span>
                ) : null}
                {pkb.jabatanDetail ? (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {pkb.jabatanDetail}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 font-mono text-[11px] font-semibold tracking-wide text-slate-400 tabular-nums">
                {pkb.nik ? `NIK ${pkb.nik}` : "NIK —"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <PhoneStatusHint phone={pkb.noHp} />
              <TpkContactAction phone={pkb.noHp} kind="call" size="sm" />
              <TpkContactAction phone={pkb.noHp} kind="whatsapp" size="sm" />
            </div>
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

      <PkbPembinaCard pkb={payload.pkb} />

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
