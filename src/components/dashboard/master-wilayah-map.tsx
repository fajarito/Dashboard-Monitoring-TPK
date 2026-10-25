"use client";

import { useEffect, useRef, useState, useCallback, useId, useMemo } from "react";
import {
  ChevronRight,
  RotateCcw,
  ArrowLeft,
  MapPin,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { MapIndicatorLegend } from "@/components/dashboard/map-indicator-legend";
import {
  buildBasePathStyle,
  buildHoverPathStyle,
  buildOutlinePathStyle,
  buildSelectedPathStyle,
  forEachPolygonLayer,
  formatChoroplethHover,
  formatHoverPrimary,
  indexThematicLookups,
  lookupMetricRow,
  lookupThematicValue,
  sdkPaletteForMetric,
  type ChoroplethPathStyle,
  type MetricRow,
  CHOROPLETH_NO_DATA,
} from "@/lib/map-choropleth";
import {
  classifyMetricRow,
  getIndicatorCategory,
  getLegendItems,
  getQuintileBreaks,
  indicatorTitle,
  type IndicatorClassification,
} from "@/lib/map-indicator";
import {
  formatMasterWilayahRenderError,
  isValidKemendagriCode,
  normalizeKemendagriDigits,
  sanitizeKemendagriCode,
  type KemendagriLevel,
} from "@/lib/kemendagri-code";
import { type MetricKey } from "@/lib/map-data";
import {
  KRS_PIN_COLORS,
  KRS_PIN_LABELS,
  KRS_PIN_PRIORITAS_ORDER,
  pinLabelInk,
  pointInPolygon,
  resolvePinPrioritas,
} from "@/lib/krs-pin-style";
import type { KrsPointItem, TpkKeluargaPrioritas } from "@/lib/data/types";
import type {
  MasterWilayahFeatureProps,
  MasterWilayahInstance,
  MasterWilayahRenderOptions,
  MasterWilayahThematicDataItem,
} from "@/types/master-wilayah";

/** Base URL Master Wilayah API/SDK. NEXT_PUBLIC_* di-inline saat `next build`. */
function resolveMasterWilayahApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MASTER_WILAYAH_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

const API_BASE_URL = resolveMasterWilayahApiBaseUrl();
const WIDGET_SCRIPT_URL = API_BASE_URL
  ? `${API_BASE_URL}/map/widget.js`
  : null;

const MISSING_ENV_MESSAGE =
  "Env NEXT_PUBLIC_MASTER_WILAYAH_API_URL belum diset (atau kosong saat build). Salin nilai dari .env.example ke .env.local, lalu restart `next dev` / rebuild. Di OpenShift, set build-arg saat image build — `oc set env` saja tidak cukup untuk NEXT_PUBLIC_*.";

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";


function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export type WilayahLevelKey = "nasional" | "provinsi" | "kabupaten" | "kecamatan" | "desa";

export type WilayahBreadcrumb = {
  level: WilayahLevelKey;
  code: string;
  name: string;
};

export type MasterWilayahMapProps = {
  metric: MetricKey;
  currentLevel: WilayahLevelKey;
  provinceCode: string | null;
  provinceName?: string | null;
  regencyCode: string | null;
  regencyName?: string | null;
  districtCode: string | null;
  districtName?: string | null;
  villageCode: string | null;
  villageName?: string | null;
  thematicData?: MasterWilayahThematicDataItem[];
  /**
   * Baris metrik live (`/api/peringkat*`) untuk hover + join stats.
   * Prioritas di atas list kab/kec/kel stub dan mock hash.
   */
  metricRows?: MetricRow[];
  kabupatenList?: { id: string; nama: string; tpk: number; krs: number }[];
  kecamatanList?: { id: string; nama: string; tpk: number; krs: number }[];
  kelurahanList?: { id: string; nama: string; tpk: number; krs: number }[];
  onDrillDown: (level: WilayahLevelKey, code: string, name: string) => void;
  onNavigateToLevel: (level: WilayahLevelKey) => void;
  onReset: () => void;
  /**
   * Mode halaman wilayah: chrome lebih ringkas (breadcrumb halaman sudah ada),
   * tetap tampilkan basemap + label tingkat.
   */
  embedded?: boolean;
  /**
   * Status fetch metrik choropleth (`/api/peringkat*` / home agregat).
   * Saat loading: overlay "Memuat indikator…" agar abu-abu sementara tidak terlihat "rusak".
   * Saat error: overlay + retry (breadcrumb tetap bisa dipakai — tidak mengunci drill selamanya).
   */
  indicatorStatus?: "idle" | "loading" | "ready" | "error";
  indicatorError?: string | null;
  onRetryIndicator?: () => void;
  /**
   * Pin KRS kelurahan (hanya meaningful di level desa).
   * Di-update tanpa remount choropleth; cluster via Leaflet.markercluster.
   */
  krsPoints?: KrsPointItem[];
  /** Filter titik di luar poligon desa aktif (ringan, client-side). */
  clipPinsToVillage?: boolean;
};

const MARKER_CLUSTER_JS =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
const MARKER_CLUSTER_CSS =
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
/** CSS cluster kustom — jangan pakai MarkerCluster.Default.css (small=hijau). */
const KRS_CLUSTER_STYLE_ID = "krs-marker-cluster-style";
const KRS_CLUSTER_CSS = `
.krs-marker-cluster {
  background: transparent;
}
.krs-marker-cluster .krs-cluster-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.28);
  font: 700 11px/1 system-ui, sans-serif;
}
.krs-marker-cluster .krs-cluster-inner span {
  line-height: 1;
}
`.trim();

function ensureKrsClusterStyle(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(KRS_CLUSTER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = KRS_CLUSTER_STYLE_ID;
  style.textContent = KRS_CLUSTER_CSS;
  document.head.appendChild(style);
}

function ensureMarkerClusterAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  ensureKrsClusterStyle();
  const L = window.L as
    | { markerClusterGroup?: unknown; MarkerClusterGroup?: unknown }
    | undefined;
  if (L && (L.markerClusterGroup || L.MarkerClusterGroup)) {
    return Promise.resolve();
  }

  if (!document.querySelector(`link[href="${MARKER_CLUSTER_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MARKER_CLUSTER_CSS;
    document.head.appendChild(link);
  }

  const existing = document.querySelector(
    `script[src="${MARKER_CLUSTER_JS}"]`,
  ) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve) => {
      if (L?.markerClusterGroup || L?.MarkerClusterGroup) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = MARKER_CLUSTER_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

type LeafletLike = {
  circleMarker: (
    latlng: [number, number],
    opts: Record<string, unknown>,
  ) => {
    bindPopup: (html: string) => unknown;
    bindTooltip: (html: string, opts?: Record<string, unknown>) => unknown;
    on?: (type: string, fn: (ev: { originalEvent?: Event }) => void) => unknown;
    options?: { fillColor?: string; krsPrioritas?: string };
  };
  divIcon?: (opts: {
    html: string;
    className?: string;
    iconSize?: unknown;
  }) => unknown;
  point?: (x: number, y: number) => unknown;
  markerClusterGroup?: (opts?: Record<string, unknown>) => {
    addLayer: (layer: unknown) => void;
    clearLayers: () => void;
    bringToFront?: () => void;
  };
  layerGroup?: () => {
    addLayer: (layer: unknown) => void;
    clearLayers: () => void;
    bringToFront?: () => void;
  };
};

function extractVillageRings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layer: any,
): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  const latlngs = layer?.getLatLngs?.();
  if (!latlngs) return rings;

  const pushRing = (ring: Array<{ lat: number; lng: number }>) => {
    if (!Array.isArray(ring) || ring.length < 3) return;
    if (typeof ring[0]?.lat !== "number") return;
    rings.push(ring.map((p) => [p.lng, p.lat] as [number, number]));
  };

  // Polygon: [ring...] or MultiPolygon: [[ring...], ...]
  if (Array.isArray(latlngs[0]) && Array.isArray(latlngs[0][0])) {
    for (const poly of latlngs) {
      if (Array.isArray(poly[0]) && typeof poly[0][0]?.lat === "number") {
        pushRing(poly[0]);
      }
    }
  } else if (Array.isArray(latlngs[0]) && typeof latlngs[0][0]?.lat === "number") {
    pushRing(latlngs[0]);
  } else if (typeof latlngs[0]?.lat === "number") {
    pushRing(latlngs);
  }
  return rings;
}

function preloadLeafletCss() {
  if (typeof document === "undefined") return;
  if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_URL;
    document.head.appendChild(link);
  }
}

function installMasterWilayahSafeguard() {
  if (typeof window === "undefined") return;
  const mw = window.MasterWilayah as
    | ({ _safeguarded?: boolean } & typeof window.MasterWilayah)
    | undefined;
  if (!mw || mw._safeguarded) return;

  const originalRender = mw.render;

  mw.render = async function (container, options) {
    const el =
      typeof container === "string"
        ? document.querySelector<HTMLElement>(container)
        : container;
    if (!el) {
      throw new Error(
        `MasterWilayah: Container element '${container}' tidak ditemukan.`,
      );
    }

    // Patch Leaflet DomUtil.getPosition defensively so missing mapPane never throws
    const patchLeaflet = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L;
      if (L?.DomUtil && !L.DomUtil._safeGetPos) {
        const origGetPos = L.DomUtil.getPosition;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        L.DomUtil.getPosition = function (node: any) {
          if (!node || typeof node !== "object") {
            return new L.Point(0, 0);
          }
          try {
            return origGetPos.call(L.DomUtil, node) || new L.Point(0, 0);
          } catch {
            return new L.Point(0, 0);
          }
        };
        L.DomUtil._safeGetPos = true;
      }
    };

    patchLeaflet();
    const interval = setInterval(patchLeaflet, 25);
    setTimeout(() => clearInterval(interval), 3000);

    try {
      const res = await originalRender.call(this, el, options);
      clearInterval(interval);
      patchLeaflet();
      return res;
    } catch (err: unknown) {
      clearInterval(interval);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("_leaflet_pos")) {
        console.warn("[MasterWilayah] Ignored stale map cleanup exception:", err);
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map: (el as any)._mw_map,
          boundaryGroup: null,
          markerGroup: null,
          fitBounds: () => {},
          destroy: () => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (el as any)._mw_map?.remove();
            } catch {
              /* ignore */
            }
          },
        };
      }
      throw err;
    }
  };

  mw._safeguarded = true;
}

function loadScriptPromise(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  preloadLeafletCss();
  if (window.MasterWilayah) {
    installMasterWilayahSafeguard();
    return Promise.resolve();
  }

  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.MasterWilayah) {
        installMasterWilayahSafeguard();
        return resolve();
      }
      existing.addEventListener("load", () => {
        installMasterWilayahSafeguard();
        resolve();
      });
      existing.addEventListener("error", (e) => reject(e));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      installMasterWilayahSafeguard();
      resolve();
    };
    script.onerror = () =>
      reject(
        new Error(
          `Tidak dapat memuat script SDK Master Wilayah dari ${src}. Periksa NEXT_PUBLIC_MASTER_WILAYAH_API_URL dan koneksi ke host Master Wilayah.`,
        ),
      );
    document.head.appendChild(script);
  });
}

const PALETTE_BY_METRIC: Record<MetricKey, ReturnType<typeof sdkPaletteForMetric>> =
  {
    tpk: sdkPaletteForMetric("tpk"),
    anggota: sdkPaletteForMetric("anggota"),
    pkb: sdkPaletteForMetric("pkb"),
    krs: sdkPaletteForMetric("krs"),
  };

/** Level Kemendagri yang dipakai MW untuk child boundaries dari klik poligon. */
function drillTargetKemendagriLevel(
  current: WilayahLevelKey,
): KemendagriLevel | null {
  if (current === "nasional") return "provinsi";
  if (current === "provinsi") return "kabupaten";
  if (current === "kabupaten") return "kecamatan";
  if (current === "kecamatan" || current === "desa") return "desa";
  return null;
}

const LEVEL_LABELS: Record<WilayahLevelKey, string> = {
  nasional: "Nasional",
  provinsi: "Provinsi",
  kabupaten: "Kabupaten / Kota",
  kecamatan: "Kecamatan",
  desa: "Desa / Kelurahan",
};

function applyBasemapTiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  selectedBasemap: "canvas" | "satellite" | "topo",
  level: WilayahLevelKey,
) {
  if (!map) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = (window as any).L;
  if (!L?.tileLayer) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map.eachLayer((l: any) => {
    if (l._url || l instanceof L.TileLayer) {
      try {
        map.removeLayer(l);
      } catch {
        /* ignore */
      }
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newTile: any = null;

  if (selectedBasemap === "satellite") {
    newTile = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "Tiles &copy; Esri",
      },
    );
  } else if (selectedBasemap === "topo") {
    newTile = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 18,
        attribution: "Tiles &copy; Esri",
      },
    );
  } else if (selectedBasemap === "canvas") {
    newTile = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    );
  }

  if (newTile) {
    try {
      newTile.addTo(map);
      newTile.bringToBack();
    } catch {
      /* ignore */
    }
  }
}

// Inject tooltip overrides directly so cards appear borderless and cleanly styled
function injectTooltipStyles() {
  if (typeof document === "undefined") return;
  const id = "mw-tooltip-custom-override";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .leaflet-tooltip.mw-tooltip {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      white-space: normal !important;
      overflow: visible !important;
    }
    .leaflet-tooltip.mw-tooltip:before,
    .leaflet-tooltip.mw-tooltip:after {
      display: none !important;
    }
    .leaflet-popup-content-wrapper {
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      line-height: normal !important;
    }
    .leaflet-popup-tip-container {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

export function MasterWilayahMap({
  metric,
  currentLevel,
  provinceCode,
  provinceName,
  regencyCode,
  regencyName,
  districtCode,
  districtName,
  villageCode,
  villageName,
  thematicData = [],
  metricRows,
  kabupatenList,
  kecamatanList,
  kelurahanList,
  onDrillDown,
  onNavigateToLevel,
  onReset,
  embedded = false,
  indicatorStatus,
  indicatorError = null,
  onRetryIndicator,
  krsPoints = [],
  clipPinsToVillage = true,
}: MasterWilayahMapProps) {
  const containerId = useId().replace(/:/g, "_");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MasterWilayahInstance | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const krsClusterRef = useRef<any>(null);

  // Concurrency lock & sequence tracking to serialize renders and avoid double-render collision
  const renderSeqRef = useRef(0);
  const renderLockRef = useRef<Promise<void>>(Promise.resolve());

  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** True setelah applyClientChoropleth sukses saat indikator siap (hindari flash abu-abu). */
  const [choroplethReady, setChoroplethReady] = useState(
    () => indicatorStatus == null,
  );
  const [basemap, setBasemap] = useState<"canvas" | "satellite" | "topo">("canvas");
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const indicatorStatusRef = useRef(indicatorStatus);
  indicatorStatusRef.current = indicatorStatus;

  const metricRowsRef = useRef(metricRows);
  metricRowsRef.current = metricRows;

  const kabupatenListRef = useRef(kabupatenList);
  kabupatenListRef.current = kabupatenList;

  const kecamatanListRef = useRef(kecamatanList);
  kecamatanListRef.current = kecamatanList;

  const kelurahanListRef = useRef(kelurahanList);
  kelurahanListRef.current = kelurahanList;

  const metricRef = useRef(metric);
  metricRef.current = metric;
  const thematicDataRef = useRef(thematicData);
  thematicDataRef.current = thematicData;

  const quintileBreaksFor = useCallback((metric: MetricKey): number[] => {
    if (metric !== "anggota") return [];
    const rows = metricRowsRef.current || [];
    const fromRows = rows
      .map((r) => r.anggota)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (fromRows.length > 0) return getQuintileBreaks(fromRows);
    const fromThematic = (thematicDataRef.current || [])
      .map((d) => d.value)
      .filter((v) => Number.isFinite(v));
    return getQuintileBreaks(fromThematic);
  }, []);

  const classifyFeature = useCallback(
    (code: string, name: string, metric: MetricKey): IndicatorClassification => {
      const breaks = quintileBreaksFor(metric);
      const liveRow = lookupMetricRow(metricRowsRef.current, code, name);
      if (liveRow) return classifyMetricRow(liveRow, metric, breaks);

      const lookups = indexThematicLookups(thematicDataRef.current);
      const choroVal = lookupThematicValue(lookups, code, name);
      if (metric === "anggota") {
        return getIndicatorCategory(metric, choroVal, { quintileBreaks: breaks });
      }
      return getIndicatorCategory(metric, choroVal, {});
    },
    [quintileBreaksFor],
  );

  const buildChoroplethTooltipHtml = useCallback(
    (props: MasterWilayahFeatureProps, pointerNone: boolean) => {
      const name = escapeHtml(props.name || "-");
      const rawCode = String(props.code || props.kode || "")
        .replace(/\./g, "")
        .trim();
      const liveRow = lookupMetricRow(
        metricRowsRef.current,
        rawCode,
        props.name || "",
      );
      const metric = metricRef.current;
      const classification = classifyFeature(rawCode, props.name || "", metric);
      const title = indicatorTitle(metric);

      let valueLines: string;
      if (metric === "anggota") {
        const primary = liveRow
          ? formatHoverPrimary(liveRow, metric)
          : classification.value != null
            ? formatChoroplethHover(classification.value, metric)
            : "Data tidak tersedia";
        const parts = (primary || "Data tidak tersedia").split("\n");
        valueLines = parts
          .map(
            (line) =>
              `<div style="font-size: 12px; font-weight: 700; color: #0a2540; line-height: 1.35;">${escapeHtml(line)}</div>`,
          )
          .join("");
      } else if (classification.status === "attention") {
        valueLines = `<div style="font-size: 12px; font-weight: 800; color: #b42318;">${escapeHtml(classification.category)}</div>`;
      } else {
        const primary =
          (liveRow ? formatHoverPrimary(liveRow, metric) : null) ??
          (classification.value != null
            ? formatChoroplethHover(classification.value, metric)
            : "—");
        valueLines = `<div style="font-size: 13px; font-weight: 800; color: #0a2540;">${escapeHtml(primary)}</div>`;
      }

      const kategoriLabel =
        metric === "anggota" ? "Kategori Sebaran" : "Kategori";
      const showKeterangan =
        metric !== "anggota" &&
        classification.status !== "noData" &&
        Boolean(classification.keterangan);

      return `
            <div style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 12px 14px; width: max-content; min-width: 240px; max-width: 320px; box-sizing: border-box; box-shadow: 0 10px 24px -6px rgba(15, 23, 42, 0.16); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;${pointerNone ? " pointer-events: none;" : ""}">
              <div style="font-size: 13px; font-weight: 800; color: #0a2540; margin-bottom: 6px;">${name}</div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">${escapeHtml(title)}</div>
              ${valueLines}
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <span style="font-size: 10px; color: #64748b; font-weight: 600;">${escapeHtml(kategoriLabel)}:</span>
                <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; color: #0a2540;">
                  <span style="width: 8px; height: 8px; border-radius: 999px; background: ${escapeHtml(classification.color)}; flex-shrink: 0;"></span>
                  ${escapeHtml(classification.category)}
                </span>
              </div>
              ${
                showKeterangan
                  ? `<div style="margin-top: 6px; font-size: 10px; font-weight: 500; color: #64748b; line-height: 1.35;">Keterangan: ${escapeHtml(classification.keterangan)}</div>`
                  : ""
              }
            </div>
          `;
    },
    [classifyFeature],
  );

  /**
   * Warnai ulang poligon yang sudah ada — tanpa destroy/remount SDK
   * (remount kedua sering meninggalkan pane kosong).
   */
  const applyClientChoropleth = useCallback(() => {
    const instance = mapInstanceRef.current;
    if (!instance?.boundaryGroup) return;

    const currentMetric = metricRef.current;
    const data = thematicDataRef.current || [];
    const rows = metricRowsRef.current || [];

    const cleanVillage =
      currentLevel === "desa" && villageCode
        ? String(villageCode).replace(/\D/g, "").trim()
        : "";

    const unmatchedDev: Array<{ code: string; name: string }> = [];

    forEachPolygonLayer(instance.boundaryGroup, (layer) => {
      const featProps = layer.feature?.properties || {};
      const codeStr = String(featProps.code || featProps.kode || "").replace(
        /\D/g,
        "",
      );
      const featName = String(featProps.name || "");

      const classification = classifyFeature(codeStr, featName, currentMetric);
      const hasData =
        classification.status === "ok" || classification.status === "attention";
      if (
        !hasData &&
        (data.length > 0 || rows.length > 0) &&
        !lookupMetricRow(rows, codeStr, featName)
      ) {
        unmatchedDev.push({ code: codeStr, name: featName });
      }

      // Level desa: tanpa fill (basemap terlihat) + polygon non-interaktif
      // agar klik mengenai pin KRS, bukan choropleth/popup desa.
      if (currentLevel === "desa") {
        const selected = Boolean(cleanVillage && codeStr === cleanVillage);
        const outline = buildOutlinePathStyle(selected);
        layer._mwBaseStyle = outline;
        layer.setStyle?.(outline);
        if (layer.options) layer.options.interactive = false;
        const el =
          typeof layer.getElement === "function"
            ? layer.getElement()
            : layer._path;
        if (el?.style) el.style.pointerEvents = "none";
        layer.unbindTooltip?.();
        layer.unbindPopup?.();
        layer.closePopup?.();
        return;
      }

      // Prov/kab/kec: choropleth spek + border selected.
      if (cleanVillage && codeStr === cleanVillage) {
        const selected = buildSelectedPathStyle(classification.color);
        layer._mwBaseStyle = selected;
        layer.setStyle?.(selected);
      } else {
        const base = buildBasePathStyle(classification.color, hasData);
        layer._mwBaseStyle = base;
        layer.setStyle?.(base);
      }
      if (layer.options) layer.options.interactive = true;
      const el =
        typeof layer.getElement === "function"
          ? layer.getElement()
          : layer._path;
      if (el?.style) el.style.pointerEvents = "";

      // Refresh tooltip saat ganti metrik (hindari HTML cache SDK / flicker).
      const tipHtml = buildChoroplethTooltipHtml(
        featProps as MasterWilayahFeatureProps,
        true,
      );
      if (typeof layer.setTooltipContent === "function" && layer.getTooltip?.()) {
        layer.setTooltipContent(tipHtml);
      } else if (typeof layer.bindTooltip === "function") {
        layer.unbindTooltip?.();
        layer.bindTooltip(tipHtml, {
          sticky: true,
          opacity: 1,
          className: "mw-tooltip",
          direction: "top",
          permanent: false,
        });
      }
      if (typeof layer.setPopupContent === "function" && layer.getPopup?.()) {
        layer.setPopupContent(
          buildChoroplethTooltipHtml(
            featProps as MasterWilayahFeatureProps,
            false,
          ),
        );
      }
    });

    if (
      process.env.NODE_ENV !== "production" &&
      unmatchedDev.length > 0 &&
      data.length > 0
    ) {
      console.warn(
        `[MasterWilayahMap] ${unmatchedDev.length} poligon tanpa join metrik (bukan nodata denom):`,
        unmatchedDev.slice(0, 20),
      );
    }

    // Indikator siap (atau tidak di-gate) → izinkan lepas overlay setelah cat pertama.
    const gate = indicatorStatusRef.current;
    if (gate == null || gate === "ready") {
      setChoroplethReady(true);
    }
  }, [currentLevel, villageCode, buildChoroplethTooltipHtml, classifyFeature]);

  // Ganti level / mulai fetch indikator baru → tutup warna sampai cat ulang.
  useEffect(() => {
    if (indicatorStatus == null) {
      setChoroplethReady(true);
      return;
    }
    if (
      indicatorStatus === "loading" ||
      indicatorStatus === "idle" ||
      indicatorStatus === "error"
    ) {
      setChoroplethReady(false);
    }
  }, [
    indicatorStatus,
    currentLevel,
    provinceCode,
    regencyCode,
    districtCode,
    villageCode,
  ]);

  // Pastikan style override tooltip terinjeksi
  useEffect(() => {
    injectTooltipStyles();
  }, []);

  // Keep latest callbacks in refs to avoid re-triggering map renders unnecessarily
  const onDrillDownRef = useRef(onDrillDown);
  useEffect(() => {
    onDrillDownRef.current = onDrillDown;
  }, [onDrillDown]);

  // Load SDK Script once — jangan pernah request `/undefined/map/widget.js`
  useEffect(() => {
    let active = true;

    if (!WIDGET_SCRIPT_URL) {
      setError(MISSING_ENV_MESSAGE);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    loadScriptPromise(WIDGET_SCRIPT_URL)
      .then(() => {
        if (active) {
          installMasterWilayahSafeguard();
          setSdkReady(true);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat widget Master Wilayah.",
          );
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Main Render Effect - strictly serialized to prevent Leaflet _leaflet_pos race condition
  const renderMap = useCallback(async () => {
    if (!sdkReady || !window.MasterWilayah || !containerRef.current) return;

    const seq = ++renderSeqRef.current;

    renderLockRef.current = renderLockRef.current.then(async () => {
      if (seq !== renderSeqRef.current) {
        // Newer render requested, skip this outdated one
        return;
      }

      setLoading(true);
      setError(null);
      if (indicatorStatusRef.current != null) {
        setChoroplethReady(false);
      }

      // Clean up previous map instance safely
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          /* ignore */
        }
        mapInstanceRef.current = null;
      }

      const el = containerRef.current;
      if (!el) return;

      // Small delay to allow Leaflet event loop cycle to detach previous DOM
      await new Promise((resolve) => setTimeout(resolve, 35));
      if (seq !== renderSeqRef.current) return;

      // Clear any leftover element references
      // @ts-expect-error Leaflet internal id cleanup
      el._leaflet_id = null;
      el.innerHTML = "";

      const palette = PALETTE_BY_METRIC[metricRef.current] || "blues";

      if (!API_BASE_URL) {
        setError(MISSING_ENV_MESSAGE);
        setLoading(false);
        return;
      }

      const safeProvince = sanitizeKemendagriCode("provinsi", provinceCode);
      const safeRegency = sanitizeKemendagriCode("kabupaten", regencyCode);
      const safeDistrict = sanitizeKemendagriCode("kecamatan", districtCode);
      const safeVillage = sanitizeKemendagriCode("desa", villageCode);

      // Validasi sebelum POST thematic — id internal / panjang salah → HTTP 500 di MW.
      if (currentLevel === "provinsi" && provinceCode && !safeProvince) {
        setError(
          formatMasterWilayahRenderError(
            new Error(
              `Kode Kemendagri provinsi tidak valid (${normalizeKemendagriDigits(provinceCode) || "kosong"}). Harus 2 digit.`,
            ),
            { level: "provinsi", code: provinceCode, name: provinceName },
          ),
        );
        setLoading(false);
        return;
      }
      if (currentLevel === "kabupaten" && regencyCode && !safeRegency) {
        setError(
          formatMasterWilayahRenderError(
            new Error(
              `Kode Kemendagri kab/kota tidak valid (${normalizeKemendagriDigits(regencyCode) || "kosong"}). Harus 4 digit — kemungkinan id internal terkirim ke peta.`,
            ),
            { level: "kabupaten", code: regencyCode, name: regencyName },
          ),
        );
        setLoading(false);
        return;
      }
      if (
        (currentLevel === "kecamatan" || currentLevel === "desa") &&
        districtCode &&
        !safeDistrict
      ) {
        setError(
          formatMasterWilayahRenderError(
            new Error(
              `Kode Kemendagri kecamatan tidak valid (${normalizeKemendagriDigits(districtCode) || "kosong"}). Harus 6 digit.`,
            ),
            { level: "kecamatan", code: districtCode, name: districtName },
          ),
        );
        setLoading(false);
        return;
      }

      const options: MasterWilayahRenderOptions = {
        apiUrl: API_BASE_URL,
        palette,
        basemap: "none" as any,
        data: thematicDataRef.current,
        zoomControl: true,
        showLabels: false,
        loadingText: "Memuat Peta Wilayah...",
        tooltipFormatter: (props: MasterWilayahFeatureProps) =>
          buildChoroplethTooltipHtml(props, true),
        popupFormatter: (props: MasterWilayahFeatureProps) =>
          buildChoroplethTooltipHtml(props, false),
        onFeatureClick: (props: MasterWilayahFeatureProps) => {
          const raw = String(props.code || props.kode || "");
          const code = normalizeKemendagriDigits(raw);
          const name = String(props.name || "").trim();
          if (!code) return;

          const targetLevel = drillTargetKemendagriLevel(currentLevel);
          if (targetLevel && !isValidKemendagriCode(targetLevel, code)) {
            console.warn(
              "[MasterWilayahMap] skip drill — kode Kemendagri tidak valid:",
              { currentLevel, code, name },
            );
            setError(
              `Kode wilayah "${name || code}" tidak valid untuk drill-down (${code}, diharapkan ${targetLevel}). Poligon ini dilewati — pilih wilayah lain.`,
            );
            return;
          }

          if (currentLevel === "nasional") {
            onDrillDownRef.current("provinsi", code, name);
          } else if (currentLevel === "provinsi") {
            onDrillDownRef.current("kabupaten", code, name);
          } else if (currentLevel === "kabupaten") {
            onDrillDownRef.current("kecamatan", code, name);
          } else if (currentLevel === "kecamatan") {
            onDrillDownRef.current("desa", code, name);
          } else if (currentLevel === "desa") {
            // Level desa: klik ditangani pin KRS — jangan drill/popup choropleth.
            return;
          }
        },
      };

      // Set hierarchical options based on active level (hanya kode tervalidasi)
      if (
        (currentLevel === "desa" || currentLevel === "kecamatan") &&
        safeDistrict
      ) {
        options.district = safeDistrict;
        if (currentLevel === "desa" && safeVillage) {
          options.data = [
            {
              code: safeVillage,
              value: 100,
              label: `Desa/Kelurahan: ${villageName || ""}`,
            },
            ...(thematicDataRef.current || []),
          ];
        }
      } else if (currentLevel === "kabupaten" && safeRegency) {
        options.regency = safeRegency;
      } else if (currentLevel === "provinsi" && safeProvince) {
        options.province = safeProvince;
      } else if (currentLevel === "nasional") {
        options.national = true;
      } else {
        // Level anak tanpa kode valid — jangan POST national dengan parent salah.
        setError(
          formatMasterWilayahRenderError(
            new Error(
              `Kode wilayah untuk level ${LEVEL_LABELS[currentLevel]} belum siap. Kembali ke level sebelumnya.`,
            ),
            { level: currentLevel },
          ),
        );
        setLoading(false);
        return;
      }

      try {
        const instance = await window.MasterWilayah!.render(el, options);
        if (seq === renderSeqRef.current) {
          mapInstanceRef.current = instance;
          setLoading(false);

          // 1. Terapkan tile basemap (Terang / Satelit / Topo)
          if (instance?.map) {
            applyBasemapTiles(instance.map, basemapRef.current, currentLevel);
          }

          // 2. Choropleth client-side + hover restore (tanpa remount saat ganti metrik).
          applyClientChoropleth();
          if (instance?.boundaryGroup) {
            forEachPolygonLayer(instance.boundaryGroup, (layer) => {
              layer.on?.("mouseover", () => {
                const base = (layer._mwBaseStyle ||
                  buildBasePathStyle(
                    CHOROPLETH_NO_DATA,
                    false,
                  )) as ChoroplethPathStyle;
                if (base.fillOpacity <= 0) return;
                layer.setStyle?.(buildHoverPathStyle(base));
                layer.bringToFront?.();
              });
              layer.on?.("mouseout", () => {
                const base = layer._mwBaseStyle as
                  | ChoroplethPathStyle
                  | undefined;
                if (base) layer.setStyle?.(base);
              });
            });

            // Desa: fitBounds saja — jangan openPopup poligon (tutup basemap/pin).
            if (currentLevel === "desa" && safeVillage) {
              forEachPolygonLayer(instance.boundaryGroup, (layer) => {
                const codeStr = normalizeKemendagriDigits(
                  layer.feature?.properties?.code ||
                    layer.feature?.properties?.kode ||
                    "",
                );
                if (codeStr === safeVillage) {
                  layer.closePopup?.();
                  if (layer.getBounds && instance.map) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (instance.map as any).fitBounds(layer.getBounds(), {
                      padding: [60, 60],
                      maxZoom: 15,
                    });
                  }
                }
              });
            }
          }
        } else {
          // If a newer render started, cleanly destroy this map
          try {
            instance?.destroy?.();
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (seq === renderSeqRef.current) {
          const activeCode =
            safeDistrict || safeRegency || safeProvince || null;
          const activeName =
            districtName || regencyName || provinceName || null;
          // Jangan spam console.error untuk 500/404 yang sudah diganti pesan UI.
          const msg = formatMasterWilayahRenderError(err, {
            level: currentLevel,
            code: activeCode,
            name: activeName,
          });
          console.warn("[MasterWilayahMap] render failed:", err);
          setError(msg);
          setLoading(false);
        }
      }
    });
  }, [
    sdkReady,
    currentLevel,
    provinceCode,
    regencyCode,
    districtCode,
    villageCode,
    villageName,
    applyClientChoropleth,
    buildChoroplethTooltipHtml,
    // metric + thematicData TIDAK di sini — recolor via effect terpisah
    // agar ganti KPI tidak merusak remount SDK (pane kosong).
  ]);

  // Ganti basemap secara instan tanpa reload atau render ulang peta
  useEffect(() => {
    if (!mapInstanceRef.current?.map) return;
    applyBasemapTiles(mapInstanceRef.current.map, basemap, currentLevel);
  }, [basemap, currentLevel]);

  /**
   * Overlay pin KRS — update tanpa remount choropleth.
   * Satu MarkerClusterGroup per prioritas (P1–P4, bukan, tidakRisiko)
   * agar cluster tidak tercampur lalu mengecat biru karena mayoritas "bukan".
   * Opsional clip ke poligon desa aktif (point-in-polygon ringan).
   */
  useEffect(() => {
    let cancelled = false;

    async function syncPins() {
      const instance = mapInstanceRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = instance?.map as any;
      const L = window.L as LeafletLike | undefined;
      if (!instance || !map || !L?.circleMarker) return;

      // Bersihkan layer lama (LayerGroup induk atau single cluster legacy)
      if (krsClusterRef.current) {
        try {
          map.removeLayer(krsClusterRef.current);
        } catch {
          /* ignore */
        }
        krsClusterRef.current = null;
      }

      if (currentLevel !== "desa" || krsPoints.length === 0) return;

      // Pastikan batas desa tetap outline-only + non-interaktif sebelum pin.
      applyClientChoropleth();

      await ensureMarkerClusterAssets();
      if (cancelled) return;

      // Pane di atas overlay polygon (400) agar pin/cluster menerima klik.
      const pinPaneName = "krsPinsPane";
      if (typeof map.createPane === "function" && !map.getPane?.(pinPaneName)) {
        const pane = map.createPane(pinPaneName);
        if (pane?.style) {
          pane.style.zIndex = "650";
          pane.style.pointerEvents = "auto";
        }
      }

      let rings: Array<Array<[number, number]>> = [];
      if (clipPinsToVillage && villageCode && instance.boundaryGroup) {
        const cleanVillage = String(villageCode).replace(/\D/g, "").trim();
        forEachPolygonLayer(instance.boundaryGroup, (layer) => {
          const codeStr = String(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (layer as any).feature?.properties?.code ||
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (layer as any).feature?.properties?.kode ||
              "",
          ).replace(/\D/g, "");
          if (codeStr === cleanVillage) {
            rings = rings.concat(extractVillageRings(layer));
          }
        });
      }

      const parent =
        typeof L.layerGroup === "function" ? L.layerGroup() : null;
      if (!parent) return;

      const clustersByPrioritas = new Map<
        TpkKeluargaPrioritas,
        {
          addLayer: (layer: unknown) => void;
          getLayers?: () => unknown[];
        }
      >();

      const makeCluster = (prioritasKey: TpkKeluargaPrioritas) => {
        const fill = KRS_PIN_COLORS[prioritasKey];
        if (typeof L.markerClusterGroup !== "function") {
          return L.layerGroup?.() ?? null;
        }
        return L.markerClusterGroup({
          maxClusterRadius: 48,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          pane: pinPaneName,
          clusterPane: pinPaneName,
          // Warna tetap per prioritas — anak dalam group ini homogen.
          iconCreateFunction: (cl: { getChildCount: () => number }) => {
            const count = cl.getChildCount();
            const size = count < 10 ? 36 : count < 40 ? 42 : 48;
            const divIcon = L.divIcon?.bind(L);
            const point = L.point?.bind(L);
            if (!divIcon) return undefined;
            return divIcon({
              html: `<div class="krs-cluster-inner" style="background-color:${fill};color:${pinLabelInk(fill)}"><span>${count}</span></div>`,
              className: "krs-marker-cluster",
              iconSize: point ? point(size, size) : [size, size],
            });
          },
        });
      };

      for (const key of KRS_PIN_PRIORITAS_ORDER) {
        const cluster = makeCluster(key);
        if (!cluster) continue;
        clustersByPrioritas.set(key, cluster);
        parent.addLayer(cluster);
      }

      for (const point of krsPoints) {
        if (
          rings.length > 0 &&
          !rings.some((ring) =>
            pointInPolygon(point.longitude, point.latitude, ring),
          )
        ) {
          continue;
        }
        const prioritasKey = resolvePinPrioritas(point.prioritas);
        const color = KRS_PIN_COLORS[prioritasKey];
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: 6,
          color: "#ffffff",
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.92,
          pane: pinPaneName,
          interactive: true,
          bubblingMouseEvents: false,
          krsPrioritas: prioritasKey,
        });
        const prioritasLabel =
          KRS_PIN_LABELS[prioritasKey] ?? point.prioritas;
        const popup = `<div style="font:12px/1.4 system-ui,sans-serif;min-width:140px">
          <strong>${escapeHtml(point.namaKepalaKeluarga)}</strong><br/>
          <span style="color:#64748b">${escapeHtml(point.kodeKeluarga)}</span><br/>
          <span style="display:inline-block;margin-top:4px;padding:1px 6px;border-radius:999px;background:${color}22;color:#0f172a;font-weight:700;font-size:10px">${escapeHtml(prioritasLabel)}${point.krs ? " · KRS" : ""}</span>
        </div>`;
        marker.bindPopup(popup);
        marker.on?.("click", (ev: { originalEvent?: Event }) => {
          ev?.originalEvent?.stopPropagation?.();
        });
        const bucket = clustersByPrioritas.get(prioritasKey);
        if (bucket) {
          bucket.addLayer(marker);
        } else {
          parent.addLayer(marker);
        }
      }

      map.addLayer(parent);
      parent.bringToFront?.();
      krsClusterRef.current = parent;
    }

    void syncPins();
    return () => {
      cancelled = true;
    };
  }, [
    krsPoints,
    currentLevel,
    villageCode,
    clipPinsToVillage,
    loading,
    applyClientChoropleth,
  ]);

  const legendItems = useMemo(() => {
    if (metric === "anggota") {
      const values = (metricRows || [])
        .map((r) => r.anggota)
        .filter((v): v is number => v != null && Number.isFinite(v));
      const breaks = getQuintileBreaks(
        values.length
          ? values
          : (thematicData || []).map((d) => d.value).filter(Number.isFinite),
      );
      return getLegendItems(metric, { quintileBreaks: breaks, values });
    }
    return getLegendItems(metric);
  }, [metric, metricRows, thematicData]);

  // Ganti metrik / thematic → recolor saja (jangan destroy Map).
  // Juga saat indikator baru ready — cat segera agar veil hilang cepat.
  useEffect(() => {
    applyClientChoropleth();
  }, [metric, thematicData, metricRows, indicatorStatus, applyClientChoropleth]);

  useEffect(() => {
    if (sdkReady) {
      void renderMap();
    }
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy();
        } catch {
          /* ignore */
        }
        mapInstanceRef.current = null;
      }
    };
  }, [sdkReady, renderMap]);

  // Compute breadcrumb items
  const breadcrumbs: { level: WilayahLevelKey; label: string; active: boolean }[] = [
    {
      level: "nasional",
      label: "Indonesia (Nasional)",
      active: currentLevel === "nasional",
    },
  ];

  if (provinceCode) {
    breadcrumbs.push({
      level: "provinsi",
      label: provinceName || `Provinsi (${provinceCode})`,
      active: currentLevel === "provinsi",
    });
  }

  if (regencyCode) {
    breadcrumbs.push({
      level: "kabupaten",
      label: regencyName || `Kab/Kota (${regencyCode})`,
      active: currentLevel === "kabupaten",
    });
  }

  if (districtCode) {
    breadcrumbs.push({
      level: "kecamatan",
      label: districtName || `Kecamatan (${districtCode})`,
      active: currentLevel === "kecamatan",
    });
  }

  if (villageCode) {
    breadcrumbs.push({
      level: "desa",
      label: villageName || `Desa/Kel (${villageCode})`,
      active: currentLevel === "desa",
    });
  }

  const getPreviousLevel = (): WilayahLevelKey | null => {
    if (currentLevel === "desa") return "kecamatan";
    if (currentLevel === "kecamatan") return "kabupaten";
    if (currentLevel === "kabupaten") return "provinsi";
    if (currentLevel === "provinsi") return "nasional";
    return null;
  };

  const prevLevel = getPreviousLevel();

  return (
    <div
      className={
        embedded
          ? "relative flex flex-col overflow-hidden bg-white"
          : "relative flex flex-col rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
      }
    >
      {/* Top Bar: Breadcrumbs & Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-xs">
        {embedded ? (
          <div className="flex items-center gap-1.5 font-semibold text-blue-600">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span>{LEVEL_LABELS[currentLevel]}</span>
          </div>
        ) : (
          <nav
            aria-label="Navigasi Wilayah"
            className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={crumb.level} className="flex items-center gap-1.5">
                  {idx > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                  {isLast ? (
                    <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigateToLevel(crumb.level)}
                      className="hover:text-blue-600 dark:hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
                    >
                      {crumb.label}
                    </button>
                  )}
                </div>
              );
            })}
          </nav>
        )}

        {/* Right side controls: Level badge, Back button, Basemap switcher */}
        <div className="flex items-center gap-2">
          {!embedded && prevLevel && (
            <button
              type="button"
              onClick={() => onNavigateToLevel(prevLevel)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title={`Kembali ke level ${LEVEL_LABELS[prevLevel]}`}
            >
              <ArrowLeft className="h-3 w-3" />
              Kembali
            </button>
          )}

          {!embedded && currentLevel !== "nasional" && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Reset ke Peta Nasional"
            >
              <RotateCcw className="h-3 w-3" />
              Nasional
            </button>
          )}

          {/* Basemap selector */}
          <div className="flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setBasemap("canvas")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
                basemap === "canvas"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Terang
            </button>
            <button
              type="button"
              onClick={() => setBasemap("satellite")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
                basemap === "satellite"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Satelit
            </button>
            <button
              type="button"
              onClick={() => setBasemap("topo")}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition ${
                basemap === "topo"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Topo
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Container */}
      <div
        className={`relative w-full bg-slate-100 dark:bg-slate-950 ${
          embedded ? "h-[420px]" : "h-[540px]"
        }`}
      >
        <div
          id={`master-wilayah-map-${containerId}`}
          ref={containerRef}
          className="w-full h-full"
        />

        {(() => {
          const indicatorBusy =
            indicatorStatus === "loading" || indicatorStatus === "idle";
          const waitingChoropleth =
            indicatorStatus === "ready" && !choroplethReady;
          // Jangan blokir basemap: chip tipis saat geometry load; veil ringan saat tunggu warna.
          const showGeometryChip = !error && loading;
          const showIndicatorVeil =
            !error &&
            !loading &&
            indicatorStatus !== "error" &&
            (indicatorBusy || waitingChoropleth);
          const showIndicatorError =
            !error && indicatorStatus === "error";
          const showLegend =
            !loading &&
            !error &&
            !showIndicatorVeil &&
            !showIndicatorError &&
            choroplethReady;

          return (
            <>
              {showLegend ? (
                <MapIndicatorLegend metric={metric} items={legendItems} />
              ) : null}

              {/* Geometry MW — chip pojok, peta/basemap tetap terlihat */}
              {showGeometryChip ? (
                <div
                  className="pointer-events-none absolute bottom-3 left-1/2 z-[1400] -translate-x-1/2"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-blue-600"
                      aria-hidden
                    />
                    Memuat peta wilayah…
                  </div>
                </div>
              ) : null}

              {/* Indikator — veil transparan + pill; pointer-events-none agar pan/drill tidak terasa terkunci */}
              {showIndicatorVeil ? (
                <div
                  className="pointer-events-none absolute inset-0 z-[1400] flex items-end justify-center bg-gradient-to-t from-white/55 via-white/10 to-transparent pb-4 dark:from-slate-950/55 dark:via-slate-950/10"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="inline-flex max-w-[min(100%,20rem)] flex-col items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/95 px-3.5 py-2 text-center shadow-md dark:border-slate-700 dark:bg-slate-900/95">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin text-blue-600"
                        aria-hidden
                      />
                      Memuat indikator…
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Basemap sudah siap · warna menyusul
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Peringkat gagal — retry; breadcrumb di atas tetap bisa navigasi */}
              {showIndicatorError ? (
                <div className="absolute inset-0 z-[1450] flex flex-col items-center justify-center p-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-[1px] text-center">
                  <AlertCircle className="h-10 w-10 text-amber-500 mb-2" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Gagal Memuat Indikator Peta
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                    {indicatorError ||
                      "Data peringkat tidak dapat dimuat. Coba lagi, atau kembali ke level sebelumnya lewat breadcrumb."}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {prevLevel ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToLevel(prevLevel)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Kembali ke {LEVEL_LABELS[prevLevel]}
                      </button>
                    ) : null}
                    {onRetryIndicator ? (
                      <button
                        type="button"
                        onClick={() => onRetryIndicator()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Coba Lagi
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          );
        })()}

        {/* Error Overlay — HTTP 500/404 tidak crash; user bisa kembali / retry */}
        {error && (
          <div className="absolute inset-0 z-[1500] flex flex-col items-center justify-center p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Gagal Memuat Peta Master Wilayah
            </h4>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">{error}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {prevLevel ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    onNavigateToLevel(prevLevel);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Kembali ke {LEVEL_LABELS[prevLevel]}
                </button>
              ) : null}
              {WIDGET_SCRIPT_URL ? (
                <button
                  type="button"
                  onClick={() => {
                    if (sdkReady) {
                      void renderMap();
                      return;
                    }
                    setError(null);
                    setLoading(true);
                    loadScriptPromise(WIDGET_SCRIPT_URL)
                      .then(() => {
                        installMasterWilayahSafeguard();
                        setSdkReady(true);
                      })
                      .catch((err) => {
                        setError(
                          formatMasterWilayahRenderError(
                            err instanceof Error
                              ? err
                              : new Error("Gagal memuat widget Master Wilayah."),
                          ),
                        );
                        setLoading(false);
                      });
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Coba Muat Ulang
                </button>
              ) : (
                <p className="text-[11px] text-slate-400 max-w-sm">
                  Perbaiki env lalu restart server lokal atau rebuild image
                  OpenShift.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
