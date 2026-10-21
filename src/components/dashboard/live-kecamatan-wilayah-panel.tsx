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
import type { DataSource, PeringkatKelurahanItem } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import type { MetricRow } from "@/lib/map-choropleth";
import { formatNumber, provinces, type MetricKey } from "@/lib/map-data";
import type { SasaranCounts } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";
import {
  isUnresolvedKabName,
  isUnresolvedKecName,
} from "@/lib/wilayah-name-labels";

function indikatorToSasaran(item: PeringkatKelurahanItem): SasaranCounts {
  return {
    ibuHamil: item.indikator.bumil,
    baduta: item.indikator.baduta,
    balita: item.indikator.balita,
    jambanTidakLayak: item.indikator.jambanTL,
    sumberAirTidakLayak: item.indikator.airTL,
    rtlh: item.indikator.rtlh ?? 0,
  };
}

/**
 * Halaman kecamatan: ringkasan + tabel desa/kelurahan dari API live.
 */
export function LiveKecamatanWilayahPanel({
  provinceSlug,
  kabSlug,
  kecSlug,
  provinsiApiId,
  kabupatenApiId,
  kecamatanApiId,
  kecName,
  kabName,
  provinceName,
}: {
  provinceSlug: string;
  kabSlug: string;
  kecSlug: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  kecamatanApiId: string;
  kecName: string;
  kabName: string;
  provinceName: string;
}) {
  const ringkasan = useRingkasanScope({
    tingkat: "kecamatan",
    id: kecamatanApiId,
  });
  const peringkat = usePeringkatKelurahan(kecamatanApiId);
  const needKabName = isUnresolvedKabName(kabName, kabupatenApiId);
  const needKecName = isUnresolvedKecName(kecName, kecamatanApiId);
  const peringkatKab = usePeringkatKabupaten(
    needKabName ? provinsiApiId : null,
  );
  const peringkatKec = usePeringkatKecamatan(
    needKecName ? kabupatenApiId : null,
  );
  const displayKabName = useMemo(() => {
    if (!needKabName) return kabName;
    const hit = peringkatKab.payload?.items.find(
      (item) =>
        item.id === kabupatenApiId ||
        item.id === String(Number(kabupatenApiId)),
    );
    const nama = hit?.nama?.trim();
    if (nama && !isUnresolvedKabName(nama, kabupatenApiId)) return nama;
    return kabName;
  }, [needKabName, kabName, peringkatKab.payload, kabupatenApiId]);
  const displayKecName = useMemo(() => {
    if (!needKecName) return kecName;
    const hit = peringkatKec.payload?.items.find(
      (item) =>
        item.id === kecamatanApiId ||
        item.id === String(Number(kecamatanApiId)),
    );
    const nama = hit?.nama?.trim();
    if (nama && !isUnresolvedKecName(nama, kecamatanApiId)) return nama;
    return kecName;
  }, [needKecName, kecName, peringkatKec.payload, kecamatanApiId]);

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

  const desaRows =
    peringkat.payload?.items.map((item) => ({
      id: item.id,
      name: item.nama,
      kindLabel: "Desa/Kelurahan",
      keluargaSasaran: item.keluargaSasaran,
      krs: item.krs,
      sasaran: indikatorToSasaran(item),
      tpkCount: item.tpk,
      href: `/wilayah/${provinceSlug}/kab/${kabSlug}/kec/${kecSlug}/desa/${encodeURIComponent(item.id)}`,
    })) ?? [];

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
            {formatNumber(desaRows.length)} desa/kelurahan
          </span>
        ) : null}
      </div>

      {ringkasan.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat ringkasan kecamatan…" rows={3} />
        </div>
      ) : null}

      {ringkasan.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat ringkasan kecamatan"
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
            scopeLabel={displayKecName}
            dataSource={ringkasan.ringkasan.meta.source}
            activeMetric={mapMetric}
            onMetricChange={setMapMetric}
          />
          {sasaranCounts ? (
            <SasaranIndikatorPanel
              scopeLabel={displayKecName}
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
          currentLevel="kecamatan"
          provinceSlug={provinceSlug}
          provinceAdminCode={provinceAdminCode}
          provinceName={provinceName}
          kabSlug={kabSlug}
          kabName={displayKabName}
          kabupatenApiId={kabupatenApiId}
          kecSlug={kecSlug}
          kecName={displayKecName}
          kecamatanApiId={kecamatanApiId}
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
          <LoadingState label="Memuat daftar desa/kelurahan…" rows={5} />
        </div>
      ) : null}

      {peringkat.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat daftar desa/kelurahan"
            description={peringkat.error ?? "Coba muat ulang."}
            onRetry={peringkat.refetch}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && desaRows.length === 0 ? (
        <div className="design-card p-5">
          <EmptyState
            title="Belum ada desa/kelurahan"
            description={`Tidak ada data desa/kelurahan untuk ${displayKecName}.`}
          />
        </div>
      ) : null}

      {peringkat.status === "ready" && desaRows.length > 0 ? (
        <WilayahChildTable
          rows={desaRows}
          scopeLabel={displayKecName}
          childLabel="Desa/Kelurahan"
          actionLabel="lihat detail"
          dataSource={peringkat.payload?.meta.source ?? dataSource}
        />
      ) : null}

      <LiveTpkListPanel
        provinceSlug={provinceSlug}
        provinsiApiId={provinsiApiId}
        initialKabupatenId={kabupatenApiId}
        initialKecamatanId={kecamatanApiId}
        provinceName={`${displayKecName} · ${displayKabName} · ${provinceName}`}
        showSummaryCards={false}
        filterLevel="kelurahan"
      />
    </div>
  );
}
