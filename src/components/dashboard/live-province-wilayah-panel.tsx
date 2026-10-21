"use client";

import { useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { LiveTpkListPanel } from "@/components/dashboard/live-tpk-list-panel";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { WilayahChildTable } from "@/components/dashboard/wilayah-child-table";
import { WilayahMapKpiCards } from "@/components/dashboard/wilayah-map-kpi-cards";
import { WilayahScopeMap } from "@/components/dashboard/wilayah-scope-map";
import type { DataSource, PeringkatKabupatenItem } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { getKabupatenSlugByApiId } from "@/lib/kabupaten-api-id";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import type { MetricRow } from "@/lib/map-choropleth";
import { formatNumber, provinces, type MetricKey } from "@/lib/map-data";
import type { SasaranCounts } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

function indikatorToSasaran(item: PeringkatKabupatenItem): SasaranCounts {
  return {
    ibuHamil: item.indikator.bumil,
    baduta: item.indikator.baduta,
    balita: item.indikator.balita,
    jambanTidakLayak: item.indikator.jambanTL,
    sumberAirTidakLayak: item.indikator.airTL,
    rtlh: item.indikator.rtlh ?? 0,
  };
}

function kindLabelFromNama(nama: string): string {
  if (/^kota\b/i.test(nama)) return "Kota";
  if (/^kabupaten\b/i.test(nama)) return "Kabupaten";
  return "Kabupaten/Kota";
}

/**
 * Halaman provinsi: ringkasan + tabel kab/kota dari API live
 * (bukan hierarki mock wilayah-hierarchy-data).
 */
export function LiveProvinceWilayahPanel({
  provinceSlug,
  provinsiApiId,
  provinceName,
}: {
  provinceSlug: string;
  /** id_provinsi numerik (string), mis. "12" untuk Jawa Barat. */
  provinsiApiId: string;
  provinceName: string;
}) {
  const ringkasan = useRingkasanScope({
    tingkat: "provinsi",
    id: provinsiApiId,
  });
  const peringkat = usePeringkatKabupaten(provinsiApiId);

  const provinceAdminCode = useMemo(() => {
    const prov = provinces.find((p) => p.id === provinceSlug);
    return String(prov?.adminCode ?? "").padStart(2, "0");
  }, [provinceSlug]);

  const [mapMetric, setMapMetric] = useState<MetricKey>("tpk");

  const mapChildRows: MetricRow[] = useMemo(
    () =>
      (peringkat.payload?.items ?? []).map((item) => ({
        id: item.id,
        nama: item.nama,
        tpk: item.tpk,
        krs: item.krs,
        pkb: item.pkb,
        anggota: item.anggota,
        keluargaSasaran: item.keluargaSasaran,
        desa: item.desa,
        rasio: item.rasio,
        rasioPkbDesa: item.rasioPkbDesa,
        kode: item.kode,
      })),
    [peringkat.payload?.items],
  );

  const dataSource: DataSource | null =
    ringkasan.ringkasan?.meta.source ??
    peringkat.payload?.meta.source ??
    null;
  const sourceBadge = resolveSourceBadge(dataSource);

  const kabRows =
    peringkat.payload?.items.map((item) => {
      const slug = getKabupatenSlugByApiId(item.id);
      return {
        id: item.id,
        name: item.nama,
        kindLabel: kindLabelFromNama(item.nama),
        keluargaSasaran: item.keluargaSasaran,
        krs: item.krs,
        sasaran: indikatorToSasaran(item),
        tpkCount: item.tpk,
        href: `/wilayah/${provinceSlug}/kab/${slug ?? item.id}`,
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
            {formatNumber(kabRows.length)} kabupaten/kota
          </span>
        ) : null}
      </div>

      {ringkasan.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat ringkasan provinsi…" rows={3} />
        </div>
      ) : null}

      {ringkasan.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat ringkasan provinsi"
            description={ringkasan.error ?? "Coba muat ulang."}
            onRetry={ringkasan.refetch}
          />
        </div>
      ) : null}

      {ringkasan.status === "ready" && ringkasan.ringkasan ? (
        <>
          <WilayahMapKpiCards
            jumlahTPK={ringkasan.ringkasan.jumlahTPK}
            jumlahAnggota={ringkasan.ringkasan.jumlahAnggota}
            jumlahPKB={ringkasan.ringkasan.jumlahPKB}
            jumlahKRS={ringkasan.ringkasan.jumlahKRS}
            scopeLabel={provinceName}
            dataSource={ringkasan.ringkasan.meta.source}
            activeMetric={mapMetric}
            onMetricChange={setMapMetric}
          />
          {sasaranCounts ? (
            <SasaranIndikatorPanel
              scopeLabel={provinceName}
              counts={sasaranCounts}
              keluargaSasaran={ringkasan.ringkasan.jumlahSasaran}
              krs={ringkasan.ringkasan.jumlahKRS}
              dataSource={ringkasan.ringkasan.meta.source}
            />
          ) : null}
        </>
      ) : null}

      {provinceAdminCode !== "00" ? (
        <WilayahScopeMap
          currentLevel="provinsi"
          provinceSlug={provinceSlug}
          provinceAdminCode={provinceAdminCode}
          provinceName={provinceName}
          metric={mapMetric}
          onMetricChange={setMapMetric}
          childRows={mapChildRows}
          childStatus={peringkat.status}
          childError={peringkat.error}
          onRetryChildren={peringkat.refetch}
        />
      ) : null}

      {peringkat.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat daftar kabupaten/kota…" rows={5} />
        </div>
      ) : null}

      {peringkat.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat daftar kabupaten/kota"
            description={peringkat.error ?? "Coba muat ulang."}
            onRetry={peringkat.refetch}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && kabRows.length === 0 ? (
        <div className="design-card p-5">
          <EmptyState
            title="Belum ada kabupaten/kota"
            description={`Tidak ada data kab/kota untuk ${provinceName}.`}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && kabRows.length > 0 ? (
        <WilayahChildTable
          rows={kabRows}
          scopeLabel={provinceName}
          childLabel="Kabupaten/Kota"
          actionLabel="lihat detail"
          dataSource={peringkat.payload?.meta.source ?? dataSource}
        />
      ) : null}

      <LiveTpkListPanel
        provinceSlug={provinceSlug}
        provinsiApiId={provinsiApiId}
        provinceName={provinceName}
        showSummaryCards={false}
        filterLevel="kabupaten"
      />
    </div>
  );
}
