"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ClientOnly } from "@/components/dashboard/client-only";
import {
  EmptyState,
  ErrorState,
  MapSkeleton,
} from "@/components/dashboard/data-state";
import type { WilayahLevelKey } from "@/components/dashboard/master-wilayah-map";
import {
  buildThematicData,
  choroplethFormulaLabel,
  DEFAULT_MAP_METRIC,
  type ChoroplethMetric,
  type MetricRow,
} from "@/lib/map-choropleth";
import { indicatorTitle } from "@/lib/map-indicator";
import type { MetricKey } from "@/lib/map-data";
import { cn } from "@/lib/utils";

const MAP_INDICATOR_OPTIONS: { key: MetricKey; short: string }[] = [
  { key: "tpk", short: "TPK : KRS" },
  { key: "anggota", short: "Anggota" },
  { key: "pkb", short: "PKB : Desa" },
  { key: "krs", short: "% KRS" },
];
import { prefetchMasterWilayahWidget } from "@/lib/client-api-cache";
import {
  listMwDistricts,
  listMwRegencies,
  listMwVillages,
  matchCodesByName,
  resolveMwCodeByName,
} from "@/lib/master-wilayah-client";
import { getKabupatenSlugByApiId } from "@/lib/kabupaten-api-id";
import { getKecamatanSlugByApiId } from "@/lib/kecamatan-api-id";

const MasterWilayahMap = dynamic(
  () =>
    import("@/components/dashboard/master-wilayah-map").then(
      (module) => module.MasterWilayahMap,
    ),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

export type WilayahScopeMapProps = {
  /** Tingkat halaman saat ini (fit kamera + anak satu level di bawah). */
  currentLevel: Exclude<WilayahLevelKey, "nasional">;
  provinceSlug: string;
  provinceAdminCode: string;
  provinceName: string;
  kabSlug?: string;
  kabName?: string | null;
  /** id_kabupaten internal — dipakai drill href. */
  kabupatenApiId?: string | null;
  kecSlug?: string;
  kecName?: string | null;
  kecamatanApiId?: string | null;
  desaSlug?: string;
  desaName?: string | null;
  kelurahanApiId?: string | null;
  /** Anak satu level di bawah — dari /api/peringkat*. */
  childRows: MetricRow[];
  childStatus: "idle" | "loading" | "ready" | "error";
  childError?: string | null;
  onRetryChildren?: () => void;
  /** Indikator aktif (dikontrol parent KPI bila ada). */
  metric?: ChoroplethMetric;
  onMetricChange?: (metric: MetricKey) => void;
};

/**
 * Peta choropleth untuk halaman wilayah (prov/kab/kec/desa).
 * Fit ke wilayah aktif; mewarnai batas level anak dari metrik live.
 */
export function WilayahScopeMap({
  currentLevel,
  provinceSlug,
  provinceAdminCode,
  provinceName,
  kabSlug,
  kabName,
  kabupatenApiId,
  kecSlug,
  kecName,
  kecamatanApiId,
  desaSlug,
  desaName,
  kelurahanApiId,
  childRows,
  childStatus,
  childError,
  onRetryChildren,
  metric: metricProp,
  onMetricChange,
}: WilayahScopeMapProps) {
  const router = useRouter();
  const [codeById, setCodeById] = useState<Map<string, string>>(new Map());
  const [regencyCode, setRegencyCode] = useState<string | null>(null);
  const [districtCode, setDistrictCode] = useState<string | null>(null);
  const [villageCode, setVillageCode] = useState<string | null>(null);
  const [resolveStatus, setResolveStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [resolveError, setResolveError] = useState<string | null>(null);
  /** Indikator peta lokal — sama spek home (4 KPI). */
  const [metric, setMetric] = useState<ChoroplethMetric>(
    metricProp ?? DEFAULT_MAP_METRIC,
  );
  useEffect(() => {
    if (metricProp) setMetric(metricProp);
  }, [metricProp]);

  // Widget MW paralel dengan fetch peringkat parent (jangan waterfall setelah resolve).
  useEffect(() => {
    prefetchMasterWilayahWidget();
  }, []);

  const provinceCode = useMemo(
    () => provinceAdminCode.replace(/\D/g, "").padStart(2, "0").slice(-2),
    [provinceAdminCode],
  );

  const childFingerprint = useMemo(
    () =>
      childRows
        .map(
          (r) =>
            `${r.id}:${r.nama}:${r.kode ?? ""}:${r.tpk}:${r.krs}:${r.anggota ?? ""}:${r.keluargaSasaran ?? ""}:${r.desa ?? ""}`,
        )
        .join("|"),
    [childRows],
  );

  useEffect(() => {
    let active = true;

    async function resolve() {
      setResolveError(null);
      try {
        // Seed dari field kode postgres bila ada
        const seeded = new Map<string, string>();
        for (const row of childRows) {
          const k = row.kode ? String(row.kode).replace(/\D/g, "") : "";
          if (k) seeded.set(row.id, k);
        }

        let nextRegency: string | null = null;
        let nextDistrict: string | null = null;
        let nextVillage: string | null = null;

        if (currentLevel === "provinsi") {
          // Unblock kamera peta segera (provinceCode cukup); lengkapi join MW di background.
          if (active) {
            setCodeById(new Map(seeded));
            setRegencyCode(null);
            setDistrictCode(null);
            setVillageCode(null);
            setResolveStatus("ready");
          }
          const mw = await listMwRegencies(provinceCode);
          if (!active) return;
          const matched = matchCodesByName(childRows, mw);
          for (const [id, code] of matched) seeded.set(id, code);
          setCodeById(new Map(seeded));
          return;
        }

        if (currentLevel === "kabupaten") {
          setResolveStatus((s) => (s === "ready" ? s : "loading"));
          nextRegency = await resolveMwCodeByName(
            "regency",
            provinceCode,
            kabName || "",
          );
          if (!nextRegency) {
            throw new Error(
              `Kode Kemendagri kab/kota tidak ditemukan untuk "${kabName}".`,
            );
          }
          // Kamera kab siap → mount map; join kecamatan menyusul.
          if (active) {
            setRegencyCode(nextRegency);
            setDistrictCode(null);
            setVillageCode(null);
            setCodeById(new Map(seeded));
            setResolveStatus("ready");
          }
          const mw = await listMwDistricts(nextRegency);
          if (!active) return;
          const matched = matchCodesByName(childRows, mw);
          for (const [id, code] of matched) seeded.set(id, code);
          setCodeById(new Map(seeded));
          return;
        }

        if (currentLevel === "kecamatan") {
          setResolveStatus((s) => (s === "ready" ? s : "loading"));
          nextRegency = await resolveMwCodeByName(
            "regency",
            provinceCode,
            kabName || "",
          );
          if (!nextRegency) {
            throw new Error(
              `Kode Kemendagri kab/kota tidak ditemukan untuk "${kabName}".`,
            );
          }
          nextDistrict = await resolveMwCodeByName(
            "district",
            nextRegency,
            kecName || "",
          );
          if (!nextDistrict) {
            throw new Error(
              `Kode Kemendagri kecamatan tidak ditemukan untuk "${kecName}".`,
            );
          }
          if (active) {
            setRegencyCode(nextRegency);
            setDistrictCode(nextDistrict);
            setVillageCode(null);
            setCodeById(new Map(seeded));
            setResolveStatus("ready");
          }
          const mw = await listMwVillages(nextDistrict);
          if (!active) return;
          const matched = matchCodesByName(childRows, mw);
          for (const [id, code] of matched) seeded.set(id, code);
          setCodeById(new Map(seeded));
          return;
        }

        if (currentLevel === "desa") {
          setResolveStatus((s) => (s === "ready" ? s : "loading"));
          nextRegency = await resolveMwCodeByName(
            "regency",
            provinceCode,
            kabName || "",
          );
          if (!nextRegency) {
            throw new Error(
              `Kode Kemendagri kab/kota tidak ditemukan untuk "${kabName}".`,
            );
          }
          nextDistrict = await resolveMwCodeByName(
            "district",
            nextRegency,
            kecName || "",
          );
          if (!nextDistrict) {
            throw new Error(
              `Kode Kemendagri kecamatan tidak ditemukan untuk "${kecName}".`,
            );
          }
          nextVillage = await resolveMwCodeByName(
            "village",
            nextDistrict,
            desaName || "",
          );
          if (!active) return;
          setCodeById(new Map(seeded));
          setRegencyCode(nextRegency);
          setDistrictCode(nextDistrict);
          setVillageCode(nextVillage);
          setResolveStatus("ready");
          return;
        }

        if (!active) return;
        setCodeById(new Map(seeded));
        setRegencyCode(nextRegency);
        setDistrictCode(nextDistrict);
        setVillageCode(nextVillage);
        setResolveStatus("ready");
      } catch (err) {
        if (!active) return;
        setResolveStatus("error");
        setResolveError(
          err instanceof Error ? err.message : "Gagal resolve kode peta.",
        );
      }
    }

    void resolve();
    return () => {
      active = false;
    };
    // childFingerprint menangkap isi childRows tanpa memicu loop referensi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentLevel,
    provinceCode,
    kabName,
    kecName,
    desaName,
    childFingerprint,
  ]);

  const thematicData = useMemo(
    () => buildThematicData(childRows, metric, codeById),
    [childRows, metric, codeById],
  );

  const handleDrillDown = useCallback(
    (level: WilayahLevelKey, code: string, name: string) => {
      const clean = code.replace(/\./g, "").trim();

      if (level === "kabupaten" && currentLevel === "provinsi") {
        // Cari id internal dari codeById terbalik atau nama
        let apiId: string | null = null;
        for (const row of childRows) {
          const kode = codeById.get(row.id) || row.kode;
          if (kode && String(kode).replace(/\D/g, "") === clean) {
            apiId = row.id;
            break;
          }
          if (row.nama.toLowerCase() === name.toLowerCase()) {
            apiId = row.id;
            break;
          }
        }
        const slug = apiId
          ? (getKabupatenSlugByApiId(apiId) ?? apiId)
          : clean;
        router.push(`/wilayah/${provinceSlug}/kab/${slug}`);
        return;
      }

      if (level === "kecamatan" && currentLevel === "kabupaten" && kabSlug) {
        let apiId: string | null = null;
        for (const row of childRows) {
          const kode = codeById.get(row.id) || row.kode;
          if (kode && String(kode).replace(/\D/g, "") === clean) {
            apiId = row.id;
            break;
          }
          if (row.nama.toLowerCase() === name.toLowerCase()) {
            apiId = row.id;
            break;
          }
        }
        const slug = apiId
          ? (getKecamatanSlugByApiId(apiId) ?? apiId)
          : clean;
        router.push(`/wilayah/${provinceSlug}/kab/${kabSlug}/kec/${slug}`);
        return;
      }

      if (
        level === "desa" &&
        currentLevel === "kecamatan" &&
        kabSlug &&
        kecSlug
      ) {
        let apiId: string | null = null;
        for (const row of childRows) {
          const kode = codeById.get(row.id) || row.kode;
          if (kode && String(kode).replace(/\D/g, "") === clean) {
            apiId = row.id;
            break;
          }
          if (row.nama.toLowerCase() === name.toLowerCase()) {
            apiId = row.id;
            break;
          }
        }
        const slug = apiId ?? clean;
        router.push(
          `/wilayah/${provinceSlug}/kab/${kabSlug}/kec/${kecSlug}/desa/${slug}`,
        );
      }
    },
    [
      childRows,
      codeById,
      currentLevel,
      kabSlug,
      kecSlug,
      provinceSlug,
      router,
    ],
  );

  const handleNavigateToLevel = useCallback(
    (level: WilayahLevelKey) => {
      if (level === "nasional") {
        router.push("/");
        return;
      }
      if (level === "provinsi") {
        router.push(`/wilayah/${provinceSlug}`);
        return;
      }
      if (level === "kabupaten" && kabSlug) {
        router.push(`/wilayah/${provinceSlug}/kab/${kabSlug}`);
        return;
      }
      if (level === "kecamatan" && kabSlug && kecSlug) {
        router.push(`/wilayah/${provinceSlug}/kab/${kabSlug}/kec/${kecSlug}`);
      }
    },
    [kabSlug, kecSlug, provinceSlug, router],
  );

  const handleReset = useCallback(() => {
    router.push("/");
  }, [router]);

  const childLabel =
    currentLevel === "provinsi"
      ? "kabupaten/kota"
      : currentLevel === "kabupaten"
        ? "kecamatan"
        : currentLevel === "kecamatan"
          ? "desa/kelurahan"
          : "batas desa";

  if (childStatus === "error") {
    return (
      <div className="design-card p-5">
        <ErrorState
          title="Gagal memuat data peta"
          description={childError ?? "Metrik wilayah anak tidak tersedia."}
          onRetry={onRetryChildren}
        />
      </div>
    );
  }

  if (resolveStatus === "error") {
    return (
      <div className="design-card p-5">
        <ErrorState
          title="Gagal menyiapkan peta wilayah"
          description={
            resolveError ??
            "Kode Kemendagri untuk kamera peta tidak dapat diselesaikan."
          }
          onRetry={() => {
            setResolveStatus("idle");
            onRetryChildren?.();
          }}
        />
      </div>
    );
  }

  // Kode kamera belum siap → skeleton. Peringkat anak boleh menyusul di overlay peta.
  if (resolveStatus === "loading" || resolveStatus === "idle") {
    return (
      <div className="design-card overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <div className="section-title">Peta sebaran · {provinceName}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Memuat indikator… menyiapkan kode wilayah &amp; batas {childLabel}.
          </p>
        </div>
        <MapSkeleton />
      </div>
    );
  }

  if (
    currentLevel !== "desa" &&
    childStatus === "ready" &&
    childRows.length === 0
  ) {
    return (
      <div className="design-card p-5">
        <EmptyState
          title={`Belum ada ${childLabel}`}
          description="Peta choropleth membutuhkan data anak di tingkat di bawah wilayah aktif."
        />
      </div>
    );
  }

  const mapMetric: MetricKey =
    metric === "rasio" || metric === "tpk"
      ? "tpk"
      : metric === "anggota"
        ? "anggota"
        : metric === "pkb"
          ? "pkb"
          : "krs";

  // childStatus "error" sudah di-return di atas — sisa: idle | loading | ready
  const indicatorStatus: "idle" | "loading" | "ready" =
    childStatus === "ready"
      ? "ready"
      : childStatus === "idle"
        ? "idle"
        : "loading";

  return (
    <div className="design-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5">
        <div className="min-w-0 flex-1">
          <div className="section-title">
            Peta sebaran ·{" "}
            {currentLevel === "desa"
              ? desaName || "Desa/Kelurahan"
              : currentLevel === "kecamatan"
                ? kecName || "Kecamatan"
                : currentLevel === "kabupaten"
                  ? kabName || "Kabupaten/Kota"
                  : provinceName}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Kamera fokus wilayah aktif. Warna = {choroplethFormulaLabel(mapMetric)}{" "}
            pada batas {childLabel} (API peringkat + Master Wilayah).
          </p>
          <div
            className="mt-3 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Pilih indikator peta"
          >
            {MAP_INDICATOR_OPTIONS.map((opt) => {
              const active = mapMetric === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setMetric(opt.key);
                    onMetricChange?.(opt.key);
                  }}
                  title={indicatorTitle(opt.key)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                    active
                      ? "border-blue-400 bg-blue-50 text-primary ring-2 ring-blue-100"
                      : "border-line bg-white text-slate-600 hover:border-blue-200 hover:text-primary",
                  )}
                >
                  {opt.short}
                </button>
              );
            })}
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-primary">
          {indicatorTitle(mapMetric)}
        </span>
      </div>

      <div className="relative mt-2">
        <ClientOnly fallback={<MapSkeleton />}>
          <MasterWilayahMap
            metric={mapMetric}
            currentLevel={currentLevel}
            provinceCode={provinceCode}
            provinceName={provinceName}
            regencyCode={regencyCode}
            regencyName={kabName}
            districtCode={districtCode}
            districtName={kecName}
            villageCode={villageCode}
            villageName={desaName}
            thematicData={thematicData}
            metricRows={childRows}
            kabupatenList={
              currentLevel === "provinsi"
                ? childRows.map((r) => ({
                    id: r.id,
                    nama: r.nama,
                    tpk: r.tpk,
                    krs: r.krs,
                  }))
                : undefined
            }
            kecamatanList={
              currentLevel === "kabupaten"
                ? childRows.map((r) => ({
                    id: r.id,
                    nama: r.nama,
                    tpk: r.tpk,
                    krs: r.krs,
                  }))
                : undefined
            }
            kelurahanList={
              currentLevel === "kecamatan" || currentLevel === "desa"
                ? childRows.map((r) => ({
                    id: r.id,
                    nama: r.nama,
                    tpk: r.tpk,
                    krs: r.krs,
                  }))
                : undefined
            }
            onDrillDown={handleDrillDown}
            onNavigateToLevel={handleNavigateToLevel}
            onReset={handleReset}
            embedded
            indicatorStatus={indicatorStatus}
            indicatorError={childError}
            onRetryIndicator={onRetryChildren}
          />
        </ClientOnly>
      </div>

      <div className="mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <div className="text-[9px] text-slate-400">
          Legenda indikator di kanan bawah peta ·{" "}
          {thematicData.length > 0
            ? `${thematicData.length} wilayah terwarna`
            : "Batas tampil · cocokkan kode Kemendagri sedang kosong"}
          {kabupatenApiId || kecamatanApiId || kelurahanApiId
            ? " · metrik live"
            : ""}
        </div>
      </div>
    </div>
  );
}
