export interface MasterWilayahThematicDataItem {
  code: string;
  value: number;
  label?: string;
}

export interface MasterWilayahMarkerItem {
  title?: string;
  nama?: string;
  lat: number;
  lng: number;
  category?: string;
  klasifikasi?: string;
  description?: string;
  alamat?: string;
  jumlah?: number;
  jumlahRumahDataku?: number;
  markerColor?: string;
  icon?: string;
  isHouse?: boolean;
}

export interface MasterWilayahFeatureProps {
  code?: string;
  kode?: string;
  name?: string;
  level?: "PROVINCE" | "REGENCY" | "DISTRICT" | "VILLAGE" | string;
  center?: [number, number];
  color?: string;
  thematic?: {
    value?: number;
    label?: string;
  } | null;
  [key: string]: unknown;
}

export interface MasterWilayahRenderOptions {
  apiUrl?: string;
  national?: boolean;
  province?: string;
  regency?: string;
  district?: string;
  level?: string;
  parentCode?: string;
  palette?: "blues" | "greens" | "reds" | "purples" | "oranges" | string;
  data?: MasterWilayahThematicDataItem[];
  markers?: MasterWilayahMarkerItem[];
  basemap?: "canvas" | "satellite" | "topo";
  styleMode?: "fill" | "line";
  fillColor?: string;
  borderColor?: string;
  borderWeight?: number;
  fillOpacity?: number;
  showLabels?: boolean;
  showBadges?: boolean;
  zoomControl?: boolean;
  loadingText?: string;
  markerColor?: string;
  markerIcon?: "pin" | "house";
  onFeatureClick?: (props: MasterWilayahFeatureProps, layer: unknown) => void;
  onMarkerClick?: (props: unknown, marker: unknown) => void;
  tooltipFormatter?: (props: MasterWilayahFeatureProps, feature: unknown) => string;
  popupFormatter?: (props: MasterWilayahFeatureProps, feature: unknown) => string;
  badgeFormatter?: (value: number | undefined, props: MasterWilayahFeatureProps) => string;
}

export interface MasterWilayahInstance {
  map: unknown;
  boundaryGroup: unknown;
  markerGroup: unknown;
  fitBounds: () => void;
  destroy: () => void;
}

export interface MasterWilayahSDK {
  render: (
    container: string | HTMLElement,
    options?: MasterWilayahRenderOptions,
  ) => Promise<MasterWilayahInstance>;
  version: string;
}

declare global {
  interface Window {
    MasterWilayah?: MasterWilayahSDK;
    L?: unknown;
  }
}
