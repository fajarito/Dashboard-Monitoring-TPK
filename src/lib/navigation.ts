import {
  BookOpenText,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Map,
  PieChart,
  TableProperties,
  UsersRound,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  note: string;
};

export const APP_NAME = "Dashboard Monitoring TPK";
export const APP_BRAND = "MONITORING TPK";
export const APP_ORG = "KEMENDUKBANGGA / BKKBN";
export const APP_AUDIENCE = "Pimpinan Pusat";
export const APP_AUDIENCE_ROLE = "Pemantau nasional";

export const navItems: NavItem[] = [
  {
    title: "Peta Sebaran",
    href: "/",
    description:
      "Lihat sebaran Tim Pendamping Keluarga di seluruh Indonesia dalam satu tampilan.",
    icon: Map,
    note: "Peta nasional choropleth interaktif dengan data simulasi. Klik wilayah dan ganti data peta (TPK / risiko stunting).",
  },
  {
    title: "Rekap TPK",
    href: "/rekap",
    description:
      "Telusuri jumlah TPK dari nasional hingga desa/kelurahan, lengkap dengan peringkat wilayah.",
    icon: TableProperties,
    note: "Kerangka penelusuran berjenjang. Nanti menampilkan total TPK, anggota, dan bandingkan antarwilayah.",
  },
  {
    title: "Komposisi Tim",
    href: "/komposisi",
    description:
      "Pahami susunan anggota TPK serta ketersediaan Koordinator PKB/PLKB di tiap wilayah.",
    icon: UsersRound,
    note: "Komposisi TPK tiga pilar: Tenaga Kesehatan, Kader PKK, dan Kader KB/PPKBD (data simulasi).",
  },
  {
    title: "Data Sasaran",
    href: "/sasaran",
    description:
      "Pantau keluarga sasaran dan indikator sederhana: baduta, balita, PUS, ibu hamil, hingga risiko stunting.",
    icon: PieChart,
    note: "Kerangka data sasaran. Nanti menampilkan indikator keluarga dan kondisi lingkungan per wilayah.",
  },
  {
    title: "Laporan Rutin",
    href: "/laporan",
    description:
      "Siapkan laporan berkala yang siap dibagikan kepada pimpinan.",
    icon: FileText,
    note: "Kerangka laporan. Nanti bisa unduh, jadwalkan, dan lihat riwayat laporan.",
  },
  {
    title: "Keterangan Istilah",
    href: "/istilah",
    description:
      "Glosarium singkat agar istilah seperti baduta, PUS, atau rumah tidak layak huni mudah dipahami.",
    icon: BookOpenText,
    note: "Glosarium hidup: Baduta, Balita, PUS, KRS, RTLH, Jamban TL, Air TL, dan istilah terkait.",
  },
];

export const brandIcon = LayoutDashboard;

/** Palette choropleth dari desain Figma Make (App.tsx). */
export const mapPalette = [
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#3b82f6",
  "#1d4ed8",
] as const;

export const mapNoDataColor = "#e2e8f0";

export const mapLegendItems = [
  { label: "Sangat sedikit", color: mapPalette[0] },
  { label: "Sedikit", color: mapPalette[1] },
  { label: "Sedang", color: mapPalette[2] },
  { label: "Banyak", color: mapPalette[3] },
  { label: "Sangat banyak", color: mapPalette[4] },
  { label: "Tanpa data", color: mapNoDataColor },
];
