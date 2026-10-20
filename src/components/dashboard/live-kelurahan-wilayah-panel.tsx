"use client";

import { useMemo } from "react";
import { AlertTriangle, BriefcaseBusiness, Users, UsersRound } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/dashboard/data-state";
import { LiveTpkListPanel } from "@/components/dashboard/live-tpk-list-panel";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import type { DataSource } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import { useRingkasanScope } from "@/lib/hooks/use-ringkasan-scope";
import { formatNumber } from "@/lib/map-data";
import type { SasaranCounts } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";
import {
  isUnresolvedKabName,
  isUnresolvedKecName,
  isUnresolvedKelName,
} from "@/lib/wilayah-name-labels";

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
 * Halaman desa/kelurahan: ringkasan live + daftar TPK terscope kelurahan.
 */
export function LiveKelurahanWilayahPanel({
  provinceSlug,
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
  const peringkatKel = usePeringkatKelurahan(
    needKelName ? kecamatanApiId : null,
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

  const dataSource: DataSource | null =
    ringkasan.ringkasan?.meta.source ?? null;
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
          <SummaryKpiCards
            jumlahTPK={ringkasan.ringkasan.jumlahTPK}
            jumlahAnggota={ringkasan.ringkasan.jumlahAnggota}
            jumlahPKB={ringkasan.ringkasan.jumlahPKB}
            jumlahKRS={ringkasan.ringkasan.jumlahKRS}
            scopeLabel={displayKelName}
            dataSource={ringkasan.ringkasan.meta.source}
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
