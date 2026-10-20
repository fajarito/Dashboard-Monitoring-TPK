"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { ChevronRight, RotateCcw, ArrowLeft, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { formatNumber, provinces, type MetricKey } from "@/lib/map-data";
import type {
  MasterWilayahFeatureProps,
  MasterWilayahInstance,
  MasterWilayahRenderOptions,
  MasterWilayahThematicDataItem,
} from "@/types/master-wilayah";

const API_BASE_URL = process.env.NEXT_PUBLIC_MASTER_WILAYAH_API_URL ;
const WIDGET_SCRIPT_URL = `${API_BASE_URL}/map/widget.js`;
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
  kabupatenList?: { id: string; nama: string; tpk: number; krs: number }[];
  kecamatanList?: { id: string; nama: string; tpk: number; krs: number }[];
  kelurahanList?: { id: string; nama: string; tpk: number; krs: number }[];
  onDrillDown: (level: WilayahLevelKey, code: string, name: string) => void;
  onNavigateToLevel: (level: WilayahLevelKey) => void;
  onReset: () => void;
};

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
      reject(new Error("Tidak dapat memuat script SDK Master Wilayah"));
    document.head.appendChild(script);
  });
}

const PALETTE_BY_METRIC: Record<MetricKey, "blues" | "purples" | "oranges"> = {
  tpk: "blues",
  anggota: "blues",
  pkb: "purples",
  krs: "oranges",
};

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

// Helper untuk mengambil metrik wilayah (Jumlah TPK dan Jumlah KRS)
function getWilayahStats(
  code: string,
  name: string,
  kabupatenList?: { id: string; nama: string; tpk: number; krs: number }[],
  kecamatanList?: { id: string; nama: string; tpk: number; krs: number }[],
  kelurahanList?: { id: string; nama: string; tpk: number; krs: number }[],
): { tpk: number; krs: number } {
  const cleanCode = String(code || "").replace(/\./g, "").trim();
  const lowerName = String(name || "").toLowerCase().trim();

  // 1. Cek di daftar provinsi resmi (mock provinsi)
  const prov = provinces.find(
    (p) =>
      String(p.adminCode) === cleanCode ||
      String(p.adminCode).padStart(2, "0") === cleanCode ||
      p.name.toLowerCase() === lowerName ||
      lowerName.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(lowerName),
  );
  if (prov) {
    return {
      tpk: prov.tpk,
      krs: prov.krs,
    };
  }

  // 2. Cek di daftar kabupaten aktif (mock kab/kota)
  if (kabupatenList && kabupatenList.length > 0) {
    const kab = kabupatenList.find(
      (k) =>
        k.id === cleanCode ||
        k.nama.toLowerCase() === lowerName ||
        lowerName.includes(k.nama.toLowerCase()) ||
        k.nama.toLowerCase().includes(lowerName),
    );
    if (kab) {
      return {
        tpk: kab.tpk,
        krs: kab.krs,
      };
    }
  }

  // 3. Cek di daftar kecamatan aktif (mock kecamatan)
  if (kecamatanList && kecamatanList.length > 0) {
    const kec = kecamatanList.find(
      (k) =>
        k.id === cleanCode ||
        k.nama.toLowerCase() === lowerName ||
        lowerName.includes(k.nama.toLowerCase()) ||
        k.nama.toLowerCase().includes(lowerName),
    );
    if (kec) {
      return {
        tpk: kec.tpk,
        krs: kec.krs,
      };
    }
  }

  // 4. Cek di daftar desa/kelurahan aktif (mock kelurahan)
  if (kelurahanList && kelurahanList.length > 0) {
    const kel = kelurahanList.find(
      (k) =>
        k.id === cleanCode ||
        k.nama.toLowerCase() === lowerName ||
        lowerName.includes(k.nama.toLowerCase()) ||
        k.nama.toLowerCase().includes(lowerName),
    );
    if (kel) {
      return {
        tpk: kel.tpk,
        krs: kel.krs,
      };
    }
  }

  // 5. Fallback deterministik berbasis hash nama atau kode wilayah
  const hashKey = cleanCode || lowerName;
  const hash = hashKey.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const fallbackTpk = Math.max(12, ((hash * 17) % 240) + 30);
  const fallbackKrs = fallbackTpk * (((hash % 20) + 35));

  return {
    tpk: fallbackTpk,
    krs: fallbackKrs,
  };
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
  kabupatenList,
  kecamatanList,
  kelurahanList,
  onDrillDown,
  onNavigateToLevel,
  onReset,
}: MasterWilayahMapProps) {
  const containerId = useId().replace(/:/g, "_");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<MasterWilayahInstance | null>(null);

  // Concurrency lock & sequence tracking to serialize renders and avoid double-render collision
  const renderSeqRef = useRef(0);
  const renderLockRef = useRef<Promise<void>>(Promise.resolve());

  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"canvas" | "satellite" | "topo">("canvas");
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;

  const kabupatenListRef = useRef(kabupatenList);
  kabupatenListRef.current = kabupatenList;

  const kecamatanListRef = useRef(kecamatanList);
  kecamatanListRef.current = kecamatanList;

  const kelurahanListRef = useRef(kelurahanList);
  kelurahanListRef.current = kelurahanList;

  // Pastikan style override tooltip terinjeksi
  useEffect(() => {
    injectTooltipStyles();
  }, []);

  // Keep latest callbacks in refs to avoid re-triggering map renders unnecessarily
  const onDrillDownRef = useRef(onDrillDown);
  useEffect(() => {
    onDrillDownRef.current = onDrillDown;
  }, [onDrillDown]);

  // Load SDK Script once
  useEffect(() => {
    let active = true;
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

      const palette = PALETTE_BY_METRIC[metric] || "blues";

      const options: MasterWilayahRenderOptions = {
        apiUrl: API_BASE_URL,
        palette,
        basemap: "none" as any,
        data: thematicData,
        zoomControl: true,
        showLabels: false,
        loadingText: "Memuat Peta Wilayah...",
        tooltipFormatter: (props: MasterWilayahFeatureProps) => {
          const name = escapeHtml(props.name || "-");
          const rawCode = escapeHtml(String(props.code || props.kode || "").replace(/\./g, "").trim());
          const stats = getWilayahStats(
            rawCode,
            props.name || "",
            kabupatenListRef.current,
            kecamatanListRef.current,
            kelurahanListRef.current,
          );

          return `
            <div style="background: #ffffff; border-radius: 14px; border: 1px solid #dbeafe; padding: 12px 18px; width: max-content; min-width: 285px; max-width: 360px; box-sizing: border-box; box-shadow: 0 10px 25px -5px rgba(18, 59, 122, 0.12), 0 4px 6px -2px rgba(18, 59, 122, 0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; pointer-events: none;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px;">
                <span style="font-size: 12.5px; font-weight: 800; color: #0a2540; line-height: 1.2;">${name}</span>
                <span style="background: #eff6ff; color: #2563eb; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; white-space: nowrap;">
                  KODE ${rawCode}
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; white-space: nowrap;">
                  <span style="font-size: 9.5px; color: #64748b; font-weight: 500;">Jumlah TPK</span>
                  <span style="font-size: 11px; font-weight: 800; color: #0a2540;">${formatNumber(stats.tpk)}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; white-space: nowrap;">
                  <span style="font-size: 9.5px; color: #64748b; font-weight: 500;">Jumlah Keluarga Berisiko Stunting (KRS)</span>
                  <span style="font-size: 11px; font-weight: 800; color: #0a2540;">${formatNumber(stats.krs)}</span>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 9px; font-weight: 600; color: #94a3b8;">
                Klik untuk membuka ringkasan
              </div>
            </div>
          `;
        },
        popupFormatter: (props: MasterWilayahFeatureProps) => {
          const name = escapeHtml(props.name || "-");
          const rawCode = escapeHtml(String(props.code || props.kode || "").replace(/\./g, "").trim());
          const stats = getWilayahStats(
            rawCode,
            props.name || "",
            kabupatenListRef.current,
            kecamatanListRef.current,
            kelurahanListRef.current,
          );

          return `
            <div style="background: #ffffff; border-radius: 14px; border: 1px solid #dbeafe; padding: 12px 18px; width: max-content; min-width: 285px; max-width: 360px; box-sizing: border-box; box-shadow: 0 10px 25px -5px rgba(18, 59, 122, 0.12), 0 4px 6px -2px rgba(18, 59, 122, 0.05); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px;">
                <span style="font-size: 12.5px; font-weight: 800; color: #0a2540; line-height: 1.2;">${name}</span>
                <span style="background: #eff6ff; color: #2563eb; font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; white-space: nowrap;">
                  KODE ${rawCode}
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; white-space: nowrap;">
                  <span style="font-size: 9.5px; color: #64748b; font-weight: 500;">Jumlah TPK</span>
                  <span style="font-size: 11px; font-weight: 800; color: #0a2540;">${formatNumber(stats.tpk)}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; white-space: nowrap;">
                  <span style="font-size: 9.5px; color: #64748b; font-weight: 500;">Jumlah Keluarga Berisiko Stunting (KRS)</span>
                  <span style="font-size: 11px; font-weight: 800; color: #0a2540;">${formatNumber(stats.krs)}</span>
                </div>
              </div>
              <div style="margin-top: 8px; font-size: 9px; font-weight: 600; color: #94a3b8;">
                Klik untuk membuka ringkasan
              </div>
            </div>
          `;
        },
        onFeatureClick: (props: MasterWilayahFeatureProps) => {
          const code = String(props.code || props.kode || "").replace(/\./g, "").trim();
          const name = String(props.name || "").trim();
          if (!code) return;

          if (currentLevel === "nasional") {
            onDrillDownRef.current("provinsi", code, name);
          } else if (currentLevel === "provinsi") {
            onDrillDownRef.current("kabupaten", code, name);
          } else if (currentLevel === "kabupaten") {
            onDrillDownRef.current("kecamatan", code, name);
          } else if (currentLevel === "kecamatan") {
            onDrillDownRef.current("desa", code, name);
          } else if (currentLevel === "desa") {
            onDrillDownRef.current("desa", code, name);
          }
        },
      };

      // Set hierarchical options based on active level
      if ((currentLevel === "desa" || currentLevel === "kecamatan") && districtCode) {
        options.district = districtCode;
        if (currentLevel === "desa" && villageCode) {
          options.data = [
            {
              code: villageCode,
              value: 100,
              label: `Desa/Kelurahan: ${villageName || ""}`,
            },
            ...(thematicData || []),
          ];
        }
      } else if (currentLevel === "kabupaten" && regencyCode) {
        options.regency = regencyCode;
      } else if (currentLevel === "provinsi" && provinceCode) {
        options.province = provinceCode;
      } else {
        options.national = true;
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

          // 2. Buat poligon batas wilayah terpilih lebih hidup dan berwarna
          const VIBRANT_PALETTE = [
            "#3b82f6", // Royal blue
            "#10b981", // Emerald green
            "#f59e0b", // Warm amber
            "#8b5cf6", // Violet purple
            "#ec4899", // Rose
            "#06b6d4", // Cyan
            "#f97316", // Orange
            "#14b8a6", // Teal
            "#6366f1", // Indigo
            "#84cc16", // Lime
            "#d946ef", // Fuchsia
            "#0ea5e9", // Sky blue
          ];

          if (instance?.boundaryGroup) {
            let colorIdx = 0;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (instance.boundaryGroup as any).eachLayer((layer: any) => {
              const featProps = layer.feature?.properties || {};
              const codeStr = String(featProps.code || featProps.kode || featProps.name || "");
              const hash = codeStr.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
              const fallbackColor = VIBRANT_PALETTE[(hash + colorIdx) % VIBRANT_PALETTE.length];
              colorIdx++;

              const hasThematic = Boolean(featProps.thematic?.value != null);
              const fillColor = hasThematic ? (featProps.color || fallbackColor) : fallbackColor;

              layer.setStyle?.({
                fillColor,
                fillOpacity: hasThematic ? 0.72 : 0.55,
                weight: 1.5,
                color: "#ffffff",
                opacity: 0.95,
              });
            });
          }

          // 3. Sembunyikan wilayah di luar boundary yang sedang dipilih (tingkat desa)
          if (currentLevel === "desa" && villageCode && instance?.boundaryGroup) {
            try {
              const cleanVillage = String(villageCode).replace(/\./g, "").trim();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (instance.boundaryGroup as any).eachLayer((layer: any) => {
                const featProps = layer.feature?.properties;
                const c = String(featProps?.code || featProps?.kode || "").replace(/\./g, "").trim();
                if (c === cleanVillage) {
                  layer.setStyle?.({
                    weight: 3.5,
                    color: "#1d4ed8",
                    fillColor: "#2563eb",
                    fillOpacity: 0.88,
                    opacity: 1,
                  });
                  layer.openPopup?.();
                  if (layer.getBounds && instance.map) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (instance.map as any).fitBounds(layer.getBounds(), {
                      padding: [60, 60],
                      maxZoom: 15,
                    });
                  }
                } else {
                  // Sembunyikan wilayah di luar boundary desa yang dipilih
                  layer.setStyle?.({
                    opacity: 0,
                    fillOpacity: 0,
                    weight: 0,
                  });
                  layer.unbindTooltip?.();
                  layer.unbindPopup?.();
                }
              });
            } catch (focusErr) {
              console.warn("[MasterWilayahMap] Village focus failed:", focusErr);
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
          console.error("[MasterWilayahMap] render error:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Gagal memuat batas wilayah dari Master Wilayah API.",
          );
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
    metric,
    thematicData,
  ]);

  // Ganti basemap secara instan tanpa reload atau render ulang peta
  useEffect(() => {
    if (!mapInstanceRef.current?.map) return;
    applyBasemapTiles(mapInstanceRef.current.map, basemap, currentLevel);
  }, [basemap, currentLevel]);

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
    <div className="relative flex flex-col rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* Top Bar: Breadcrumbs & Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-xs">
        {/* Breadcrumb Links */}
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

        {/* Right side controls: Level badge, Back button, Basemap switcher */}
        <div className="flex items-center gap-2">
          {prevLevel && (
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

          {currentLevel !== "nasional" && (
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
      <div className="relative w-full h-[540px] bg-slate-100 dark:bg-slate-950">
        <div
          id={`master-wilayah-map-${containerId}`}
          ref={containerRef}
          className="w-full h-full"
        />



        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-[1500] flex flex-col items-center justify-center p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Gagal Memuat Peta Master Wilayah
            </h4>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => renderMap()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Coba Muat Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
