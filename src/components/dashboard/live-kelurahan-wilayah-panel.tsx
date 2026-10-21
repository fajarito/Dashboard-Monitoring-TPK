"use client";

import { useMemo, useState } from "react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { LiveTpkListPanel } from "@/components/dashboard/live-tpk-list-panel";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { WilayahMapKpiCards } from "@/components/dashboard/wilayah-map-kpi-cards";
import { WilayahScopeMap } from "@/components/dashboard/wilayah-scope-map";
import type { DataSource } from "@/lib/data/types";
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
  isUnresolvedKelName,
} from "@/lib/wilayah-name-labels";

/**
 * Halaman desa/kelurahan: ringkasan live + daftar TPK terscope kelurahan.
 */
export function LiveKelurahanWilayahPanel({
  provinceSlug,
  kabSlug,
  kecSlug,
  desaSlug,
  provinsiApiId,
  kabupatenApiId,
  kecamatanApiId,
  kelurahanApiId,
  kelName,
  kecName,
  kabName,
  provinceName,
}: {
  provinceSlug: string;
  kabSlug: string;
  kecSlug: string;
  desaSlug: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  kecamatanApiId: string;
  kelurahanApiId: string;
  kelName: string;
  kecName: string;
  kabName: string;
  provinceName: string;
}) {
  const ringkasan = useRingkasanScope({
    tingkat: "kelurahan",
    id: kelurahanApiId,
  });
  const needKabName = isUnresolvedKabName(kabName, kabupatenApiId);
  const needKecName = isUnresolvedKecName(kecName, kecamatanApiId);
  const needKelName = isUnresolvedKelName(kelName, kelurahanApiId);
  const peringkatKab = usePeringkatKabupaten(
    needKabName ? provinsiApiId : null,
  );
  const peringkatKec = usePeringkatKecamatan(
    needKecName ? kabupatenApiId : null,
  );
  /** Selalu ambil saudara desa untuk choropleth di tingkat desa. */
  const peringkatKel = usePeringkatKelurahan(kecamatanApiId);

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

  const displayKelName = useMemo(() => {
    if (!needKelName) return kelName;
    const hit = peringkatKel.payload?.items.find(
      (item) =>
        item.id === kelurahanApiId ||
        item.id === String(Number(kelurahanApiId)),
    );
    const nama = hit?.nama?.trim();
    if (nama && !isUnresolvedKelName(nama, kelurahanApiId)) return nama;
    return kelName;
  }, [needKelName, kelName, peringkatKel.payload, kelurahanApiId]);

  const provinceAdminCode = useMemo(() => {
    const prov = provinces.find((p) => p.id === provinceSlug);
    return String(prov?.adminCode ?? "").padStart(2, "0");
  }, [provinceSlug]);

  const [mapMetric, setMapMetric] = useState<MetricKey>("tpk");

  const mapChildRows: MetricRow[] = useMemo(
    () =>
      (peringkatKel.payload?.items ?? []).map((item) => ({
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
    [peringkatKel.payload?.items],
  );

  const dataSource: DataSource | null =
    ringkasan.ringkasan?.meta.source ??
    peringkatKel.payload?.meta.source ??
    null;
  const sourceBadge = resolveSourceBadge(dataSource);

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

  const ringkasanEmpty =
    ringkasan.status === "ready" &&
    ringkasan.ringkasan != null &&
    ringkasan.ringkasan.jumlahTPK === 0 &&
    ringkasan.ringkasan.jumlahKRS === 0;

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
        ) : ringkasan.status === "loading" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
            Memuat…
          </span>
        ) : null}
      </div>

      {ringkasan.status === "loading" ? (
        <div className="design-card">
          <LoadingState label="Memuat ringkasan desa/kelurahan…" rows={3} />
        </div>
      ) : null}

      {ringkasan.status === "error" ? (
        <div className="design-card p-5">
          <ErrorState
            title="Gagal memuat ringkasan desa/kelurahan"
            description={ringkasan.error ?? "Coba muat ulang."}
            onRetry={ringkasan.refetch}
          />
        </div>
      ) : null}

      {ringkasanEmpty ? (
        <div className="design-card p-5">
          <EmptyState
            title="Belum ada data di desa/kelurahan ini"
            description={`Ringkasan ${displayKelName} masih kosong. Daftar TPK di bawah mengikuti filter kelurahan.`}
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
            scopeLabel={displayKelName}
            dataSource={ringkasan.ringkasan.meta.source}
            activeMetric={mapMetric}
            onMetricChange={setMapMetric}
          />
          {sasaranCounts ? (
            <SasaranIndikatorPanel
              scopeLabel={displayKelName}
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
          currentLevel="desa"
          provinceSlug={provinceSlug}
          provinceAdminCode={provinceAdminCode}
          provinceName={provinceName}
          kabSlug={kabSlug}
          kabName={displayKabName}
          kabupatenApiId={kabupatenApiId}
          kecSlug={kecSlug}
          kecName={displayKecName}
          kecamatanApiId={kecamatanApiId}
          desaSlug={desaSlug}
          desaName={displayKelName}
          kelurahanApiId={kelurahanApiId}
          metric={mapMetric}
          onMetricChange={setMapMetric}
          childRows={mapChildRows}
          childStatus={peringkatKel.status}
          childError={peringkatKel.error}
          onRetryChildren={peringkatKel.refetch}
        />
      ) : null}

      <LiveTpkListPanel
        provinceSlug={provinceSlug}
        provinsiApiId={provinsiApiId}
        initialKabupatenId={kabupatenApiId}
        initialKecamatanId={kecamatanApiId}
        initialKelurahanId={kelurahanApiId}
        provinceName={`${displayKelName} · ${displayKecName} · ${displayKabName} · ${provinceName}`}
        showSummaryCards={false}
        filterLevel="none"
      />
    </div>
  );
}
