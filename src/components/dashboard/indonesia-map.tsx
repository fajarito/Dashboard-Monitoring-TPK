"use client";

import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}

import {
  ErrorState,
  MapSkeleton,
} from "@/components/dashboard/data-state";
import {
  formatNumber,
  getProvinceByAdminCode,
  metricLabels,
  provinces,
  type MetricKey,
  type Province,
} from "@/lib/map-data";
import { getMapFillExpression } from "@/lib/map-style";
import { mapNoDataColor } from "@/lib/navigation";
import { getProvinceFocus } from "@/lib/province-focus";

type Hovered = {
  name: string;
  code: number;
  region?: Province;
};

type IndonesiaMapProps = {
  metric: MetricKey;
  selected: Province | null;
  onSelect: (province: Province) => void;
  /** Demo/error paksa untuk menampilkan state gagal. */
  forceError?: boolean;
  onRetryError?: () => void;
};

export function IndonesiaMap({
  metric,
  selected,
  onSelect,
  forceError = false,
  onRetryError,
}: IndonesiaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const metricRef = useRef(metric);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [bootKey, setBootKey] = useState(0);

  metricRef.current = metric;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (forceError) {
      setError("Demo: peta gagal dimuat (parameter ?demo=error).");
      setReady(false);
      return;
    }
    setError(null);
  }, [forceError]);

  useEffect(() => {
    if (forceError) return;
    let active = true;
    let map: MapLibreMap | null = null;

    const boot = async () => {
      try {
        const response = await fetch("/data/indonesia-provinces.geojson");
        if (!response.ok) throw new Error("GeoJSON tidak dapat dimuat");
        const data = await response.json();
        if (
          !data ||
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Format GeoJSON tidak valid");
        }

        if (
          !("WebGL2RenderingContext" in window) &&
          !("WebGLRenderingContext" in window)
        ) {
          throw new Error("WebGL tidak didukung di browser ini");
        }

        const joined = {
          ...data,
          features: data.features.map(
            (feature: {
              properties?: Record<string, unknown>;
              [key: string]: unknown;
            }) => {
              const code = Number(feature.properties?.kode);
              const region = getProvinceByAdminCode(code);
              return {
                ...feature,
                id: code,
                properties: {
                  ...feature.properties,
                  provinceCode: code,
                  provinceName:
                    region?.name ??
                    String(feature.properties?.Propinsi ?? "Provinsi"),
                  ...(region
                    ? {
                        provinceId: region.id,
                        tpk: region.tpk,
                        krs: region.krs,
                        anggota: region.anggota,
                        pkb: region.pkb,
                      }
                    : {}),
                },
              };
            },
          ),
        };

        if (!active || !containerRef.current) return;

        map = new MapLibreMap({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {},
            layers: [
              {
                id: "executive-background",
                type: "background",
                paint: { "background-color": "#f5f8fe" },
              },
            ],
          },
          center: [118, -2],
          zoom: 3.4,
          minZoom: 2.5,
          maxZoom: 8,
          maxBounds: [
            [88, -17],
            [148, 12],
          ],
          renderWorldCopies: false,
          attributionControl: false,
        });
        mapRef.current = map;

        map.addControl(
          new NavigationControl({
            showCompass: false,
            visualizePitch: false,
          }),
          "bottom-right",
        );
        map.addControl(
          new AttributionControl({
            compact: true,
            customAttribution: "Batas: BAKOSURTANAL / Dukcapil 2019",
          }),
          "bottom-left",
        );

        map.on("load", () => {
          if (!active || !map) return;
          map.addSource("indonesia-provinces", {
            type: "geojson",
            data: joined,
            promoteId: "provinceCode",
            attribution: "BAKOSURTANAL / Dukcapil 2019",
          });
          map.addLayer({
            id: "province-fill",
            type: "fill",
            source: "indonesia-provinces",
            paint: {
              "fill-color": getMapFillExpression(metricRef.current) as never,
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                1,
                0.92,
              ],
            },
          });
          map.addLayer({
            id: "province-boundaries",
            type: "line",
            source: "indonesia-provinces",
            paint: {
              "line-color": "#ffffff",
              "line-width": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                2.2,
                0.8,
              ],
              "line-opacity": 1,
            },
          });
          map.fitBounds(
            [
              [94, -11.5],
              [141.5, 6.5],
            ],
            {
              padding: { top: 20, right: 35, bottom: 20, left: 35 },
              duration: 0,
            },
          );
          setReady(true);
        });

        const handleHover = (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const provinceId = String(feature.properties?.provinceId ?? "");
          const region = provinces.find((item) => item.id === provinceId);
          setHovered({
            name: String(
              feature.properties?.provinceName ??
                feature.properties?.Propinsi ??
                "Provinsi",
            ),
            code: Number(
              feature.properties?.provinceCode ?? feature.properties?.kode ?? 0,
            ),
            region,
          });
          if (map) map.getCanvas().style.cursor = region ? "pointer" : "default";
        };

        const handleLeave = () => {
          setHovered(null);
          if (map) map.getCanvas().style.cursor = "";
        };

        const handleClick = (event: MapMouseEvent & MapLayerMouseEvent) => {
          const provinceId = String(
            event.features?.[0]?.properties?.provinceId ?? "",
          );
          const region = provinces.find((item) => item.id === provinceId);
          if (region) onSelectRef.current(region);
        };

        map.on("mousemove", "province-fill", handleHover);
        map.on("mouseleave", "province-fill", handleLeave);
        map.on("click", "province-fill", handleClick);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Peta gagal dimuat",
          );
        }
      }
    };

    void boot();

    return () => {
      active = false;
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [bootKey, forceError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("province-fill")) return;
    map.setPaintProperty(
      "province-fill",
      "fill-color",
      getMapFillExpression(metric) as never,
    );
  }, [metric]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("indonesia-provinces")) return;
    for (const province of provinces) {
      map.setFeatureState(
        { source: "indonesia-provinces", id: province.adminCode },
        { selected: selected?.adminCode === province.adminCode },
      );
    }
    if (selected && ready) {
      const focus = getProvinceFocus(selected);
      map.flyTo({
        center: focus.center,
        zoom: Math.min(focus.zoom, 8),
        essential: true,
        duration: 900,
      });
    }
  }, [selected, ready]);

  if (error) {
    return (
      <ErrorState
        className="min-h-[360px] md:min-h-[420px]"
        title="Peta tidak dapat ditampilkan"
        description={`${error} Anda masih bisa memilih provinsi dari pill cepat atau tabel di bawah.`}
        onRetry={() => {
          if (forceError) {
            onRetryError?.();
            return;
          }
          setError(null);
          setReady(false);
          setBootKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div className="relative min-h-[360px] bg-blue-50/30">
      <div
        ref={containerRef}
        className="h-[360px] w-full md:h-[420px]"
        role="application"
        aria-label="Peta choropleth administratif provinsi Indonesia"
      />
      {!ready ? <MapSkeleton className="pointer-events-none absolute inset-0" /> : null}

      {hovered && ready ? (
        <div className="pointer-events-none absolute top-5 left-1/2 z-10 min-w-52 -translate-x-1/2 rounded-xl border border-blue-100 bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-extrabold text-navy">{hovered.name}</span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-primary">
              KODE {hovered.code}
            </span>
          </div>
          {hovered.region ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1">
                <span className="text-[9px] text-muted-foreground">
                  {metricLabels.tpk}
                </span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.region.tpk)}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {metricLabels.krs}
                </span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.region.krs)}
                </span>
              </div>
              <div className="mt-1 text-[9px] font-semibold text-slate-400">
                Klik untuk membuka ringkasan
              </div>
            </>
          ) : (
            <div className="mt-2 text-[10px] text-muted-foreground">
              Data simulasi belum tersedia
            </div>
          )}
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-3 left-3 h-2.5 w-5 opacity-0"
        style={{ backgroundColor: mapNoDataColor }}
        aria-hidden
      />
    </div>
  );
}
