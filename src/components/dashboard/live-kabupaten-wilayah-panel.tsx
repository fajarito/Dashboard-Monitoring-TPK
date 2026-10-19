"use client";

import { AlertTriangle, BriefcaseBusiness, Users, UsersRound } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { LiveTpkListPanel } from "@/components/dashboard/live-tpk-list-panel";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { WilayahChildTable } from "@/components/dashboard/wilayah-child-table";
import type { DataSource, PeringkatKecamatanItem } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { getKecamatanSlugByApiId } from "@/lib/kecamatan-api-id";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { formatNumber } from "@/lib/map-data";
import type { SasaranCounts } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

function indikatorToSasaran(item: PeringkatKecamatanItem): SasaranCounts {
  return {
    ibuHamil: item.indikator.bumil,
    baduta: item.indikator.baduta,
    balita: item.indikator.balita,
    jambanTidakLayak: item.indikator.jambanTL,
    sumberAirTidakLayak: item.indikator.airTL,
    rtlh: item.indikator.rtlh ?? 0,
  };
}

function SummaryKpiCards({
  jumlahTPK,
  jumlahAnggota,
  jumlahPKB,
  jumlahKRS,
  scopeLabel,
  dataSource,
}: {
  jumlahTPK: number;
  jumlahAnggota: number;
  jumlahPKB: number;
  jumlahKRS: number;
  scopeLabel: string;
  dataSource: DataSource | null;
}) {
  const sourceHint =
    dataSource === "postgres"
      ? "live"
      : dataSource === "mock"
        ? "simulasi"
        : "agregat";

  const cards = [
    {
      id: "tpk",
      label: "Jumlah Tim TPK",
      value: jumlahTPK,
      unit: "tim",
      hint: `Di ${scopeLabel}`,
      icon: UsersRound,
      color: "bg-blue-50 text-primary",
    },
    {
      id: "anggota",
      label: "Jumlah Anggota TPK",
      value: jumlahAnggota,
      unit: "orang",
      hint: `Personel (${sourceHint})`,
      icon: Users,
      color: "bg-cyan-50 text-cyan-700",
    },
    {
      id: "pkb",
      label: "Jumlah PKB",
      value: jumlahPKB,
      unit: "petugas",
      hint: `PKB/PLKB unik (${sourceHint})`,
      icon: BriefcaseBusiness,
      color: "bg-violet-50 text-violet-700",
    },
    {
      id: "krs",
      label: "KRS di wilayah ini",
      value: jumlahKRS,
      unit: "keluarga",
      hint: `Berisiko stunting (${sourceHint})`,
      icon: AlertTriangle,
      color: "bg-amber-50 text-amber-800",
    },
  ] as const;

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={`Ringkasan ${scopeLabel}`}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.id}
            className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[var(--shadow-soft)] sm:px-6 sm:py-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {card.label}
              </div>
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-xl ${card.color}`}
              >
                <Icon className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-navy tabular-nums">
                {formatNumber(card.value)}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {card.unit}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400">{card.hint}</div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * Halaman kab/kota: ringkasan + tabel kecamatan dari API live.
 */
export function LiveKabupatenWilayahPanel({
  provinceSlug,
  kabSlug,
  provinsiApiId,
  kabupatenApiId,
  kabName,
  provinceName,
}: {
  provinceSlug: string;
  kabSlug: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  kabName: string;
  provinceName: string;
}) {
  const ringkasan = useRingkasanScope({
    tingkat: "kabupaten",
    id: kabupatenApiId,
  });
  const peringkat = usePeringkatKecamatan(kabupatenApiId);

  const dataSource: DataSource | null =
    ringkasan.ringkasan?.meta.source ??
    peringkat.payload?.meta.source ??
    null;
  const sourceBadge = resolveSourceBadge(dataSource);

  const kecRows =
    peringkat.payload?.items.map((item) => {
      const slug = getKecamatanSlugByApiId(item.id);
      return {
        id: item.id,
        name: item.nama,
        kindLabel: "Kecamatan",
        keluargaSasaran: item.keluargaSasaran,
        krs: item.krs,
        sasaran: indikatorToSasaran(item),
        tpkCount: item.tpk,
        href: `/wilayah/${provinceSlug}/kab/${kabSlug}/kec/${slug ?? item.id}`,
      };
    }) ?? [];

  const sasaranCounts: SasaranCounts | null = ringkasan.ringkasan
    ? {
        ibuHamil: ringkasan.ringkasan.indikator.bumil,
        baduta: ringkasan.ringkasan.indikator.baduta,
        balita: ringkasan.ringkasan.indikator.balita,
        jambanTidakLayak: ringkasan.ringkasan.indikator.jambanTL,
        sumberAirTidakLayak: ringkasan.ringkasan.indikator.airTL,
        rtlh: ringkasan.ringkasan.indikator.rtlh ?? 0,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {sourceBadge ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
              sourceBadge.className,
            )}
          >
            {sourceBadge.label}
          </span>
        ) : ringkasan.status === "loading" ||
          peringkat.status === "loading" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
            Memuat…
          </span>
        ) : null}
        {peringkat.status === "ready" ? (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
            {formatNumber(kecRows.length)} kecamatan
          </span>
        ) : null}
      </div>

      {ringkasan.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat ringkasan kabupaten/kota…" rows={3} />
        </div>
      ) : null}

      {ringkasan.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat ringkasan kabupaten/kota"
            description={ringkasan.error ?? "Coba muat ulang."}
            onRetry={ringkasan.refetch}
          />
        </div>
      ) : null}

      {ringkasan.status === "ready" && ringkasan.ringkasan ? (
        <>
          <SummaryKpiCards
            jumlahTPK={ringkasan.ringkasan.jumlahTPK}
            jumlahAnggota={ringkasan.ringkasan.jumlahAnggota}
            jumlahPKB={ringkasan.ringkasan.jumlahPKB}
            jumlahKRS={ringkasan.ringkasan.jumlahKRS}
            scopeLabel={kabName}
            dataSource={ringkasan.ringkasan.meta.source}
          />
          {sasaranCounts ? (
            <SasaranIndikatorPanel
              scopeLabel={kabName}
              counts={sasaranCounts}
              keluargaSasaran={ringkasan.ringkasan.jumlahSasaran}
              krs={ringkasan.ringkasan.jumlahKRS}
              dataSource={ringkasan.ringkasan.meta.source}
            />
          ) : null}
        </>
      ) : null}

      {peringkat.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat daftar kecamatan…" rows={5} />
        </div>
      ) : null}

      {peringkat.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat daftar kecamatan"
            description={peringkat.error ?? "Coba muat ulang."}
            onRetry={peringkat.refetch}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && kecRows.length === 0 ? (
        <div className="design-card p-5">
          <EmptyState
            title="Belum ada kecamatan"
            description={`Tidak ada data kecamatan untuk ${kabName}.`}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && kecRows.length > 0 ? (
        <WilayahChildTable
          rows={kecRows}
          scopeLabel={kabName}
          childLabel="Kecamatan"
          actionLabel="lihat detail"
          dataSource={peringkat.payload?.meta.source ?? dataSource}
        />
      ) : null}

      <LiveTpkListPanel
        provinceSlug={provinceSlug}
        provinsiApiId={provinsiApiId}
        initialKabupatenId={kabupatenApiId}
        provinceName={`${kabName} · ${provinceName}`}
        showSummaryCards={false}
        filterLevel="kecamatan"
      />
    </div>
  );
}
