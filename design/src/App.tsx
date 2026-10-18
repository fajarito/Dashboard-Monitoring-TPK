import { useEffect, useMemo, useRef, useState } from "react"
import {
  AttributionControl,
  Map as MapLibreMap,
  NavigationControl,
  type MapLayerMouseEvent,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps"
import { Icon } from "./components/Icons"
import {
  bogorSubdistricts,
  formatNumber,
  memberComposition,
  nationalMetrics,
  priorityData,
  provinces,
  westJavaCities,
  type MetricKey,
  type Region,
} from "./data/mockData"
import {
  indicatorSchema,
  normalizeRegionKey,
  ratioDataRequirements,
  type RegionLevel,
} from "./data/indicatorSchema"
import { selectAuthoritativeTpkCount } from "./data/authoritativeTpkSelector"
import {
  getJawaBaratRecordByBpsCode,
  getStagingRatioContext,
} from "./data/tpkStagingAdapter"

const metricLabels: Record<MetricKey, string> = {
  tpk: "Jumlah TPK",
  anggota: "Anggota TPK",
  pkb: "PKB/PLKB",
  krs: "Keluarga Berisiko Stunting",
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "icon"
}

function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-primary text-white border-primary hover:bg-primary-dark shadow-button",
    secondary:
      "bg-white text-ink border-line hover:border-blue-300 hover:bg-blue-50",
    ghost: "border-transparent text-muted hover:bg-blue-50 hover:text-primary",
    icon: "border-line bg-white text-muted hover:text-primary hover:border-blue-300",
  }
  return (
    <button
      className={`control ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

function SearchField({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  compact?: boolean
}) {
  return (
    <label className={`search-field ${compact ? "h-10" : "h-11"}`}>
      <Icon name="search" className="size-4 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-slate-400 hover:text-primary"
          aria-label="Hapus pencarian"
        >
          <Icon name="close" className="size-3.5" />
        </button>
      )}
    </label>
  )
}

function SelectField({
  value,
  onChange,
  children,
  icon,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
  icon?: "calendar" | "filter"
}) {
  return (
    <label className="select-field">
      {icon && <Icon name={icon} className="size-4 text-slate-400" />}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm font-medium text-ink outline-none"
      >
        {children}
      </select>
    </label>
  )
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center rounded-xl bg-primary text-white shadow-button">
        <div className="grid grid-cols-2 gap-0.5">
          <span className="size-2 rounded-sm bg-white" />
          <span className="size-2 rounded-sm bg-blue-200" />
          <span className="size-2 rounded-sm bg-cyan-300" />
          <span className="size-2 rounded-sm bg-white" />
        </div>
      </div>
      <div>
        <div className="text-sm font-extrabold tracking-tight text-navy">
          MONITORING TPK
        </div>
        <div className="mt-0.5 text-[10px] font-semibold tracking-widest text-slate-400">
          KEMENDUKBANGGA / BKKBN
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  detail,
  onNational,
}: {
  detail: boolean
  onNational: () => void
}) {
  const items = [
    {
      icon: "grid" as const,
      label: "Dashboard",
      active: !detail,
      action: onNational,
    },
    { icon: "map" as const, label: "Wilayah", active: detail },
    { icon: "team" as const, label: "Tim Pendamping", active: false },
    { icon: "report" as const, label: "Laporan", active: false },
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white px-5 py-6 xl:flex">
      <BrandMark />
      <div className="mt-9 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        Menu utama
      </div>
      <nav className="mt-3 space-y-1">
        {items.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            onClick={item.action}
            className={`w-full justify-start gap-3 px-3 ${
              item.active ? "bg-blue-50 !text-primary" : ""
            }`}
          >
            <Icon name={item.icon} className="size-[18px]" />
            <span className="text-sm font-semibold">{item.label}</span>
            {item.active && (
              <span className="ml-auto size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl bg-gradient-to-br from-navy to-primary p-4 text-white">
        <div className="text-xs font-bold">Pusat Bantuan</div>
        <p className="mt-1 text-[11px] leading-relaxed text-blue-100">
          Butuh bantuan membaca indikator dashboard?
        </p>
        <Button className="mt-3 h-8 w-full border-white/20 bg-white/10 text-xs text-white hover:bg-white/20">
          Lihat panduan
        </Button>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
        <div className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-primary">
          AP
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-ink">Admin Pusat</div>
          <div className="text-[10px] text-muted">Pemantau nasional</div>
        </div>
        <Icon name="chevron" className="ml-auto size-4 text-slate-400" />
      </div>
    </aside>
  )
}

function Header({
  query,
  setQuery,
  month,
  setMonth,
  year,
  setYear,
  onSelectProvince,
  onSelectCity,
}: {
  query: string
  setQuery: (value: string) => void
  month: string
  setMonth: (value: string) => void
  year: string
  setYear: (value: string) => void
  onSelectProvince: (region: Region) => void
  onSelectCity: (cityId: string) => void
}) {
  const [regionOpen, setRegionOpen] = useState(false)
  const [province, setProvince] = useState("jabar")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [village, setVillage] = useState("")
  const matches =
    query.length > 1
      ? provinces
          .filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5)
      : []
  const cityMatches =
    query.length > 1
      ? westJavaCities
          .filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5)
      : []
  return (
    <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-line bg-white/90 px-5 py-3 backdrop-blur-xl md:px-8">
      <div className="relative w-full max-w-xs 2xl:max-w-sm">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Cari seluruh tingkatan wilayah..."
        />
        {(matches.length > 0 || cityMatches.length > 0) && (
          <div className="absolute inset-x-0 top-12 rounded-xl border border-line bg-white p-2 shadow-card">
            {matches.map((region) => (
              <Button
                key={region.id}
                variant="ghost"
                className="h-auto w-full justify-start px-3 py-2.5"
                onClick={() => onSelectProvince(region)}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-primary">
                  <Icon name="map" className="size-4" />
                </span>
                <span className="ml-2 text-left">
                  <span className="block text-xs font-bold">{region.name}</span>
                  <span className="block text-[10px] text-muted">
                    {region.capital}
                  </span>
                </span>
              </Button>
            ))}
            {cityMatches.map((matchedCity) => (
              <Button
                key={matchedCity.id}
                variant="ghost"
                className="h-auto w-full justify-start px-3 py-2.5"
                onClick={() => onSelectCity(matchedCity.id)}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600">
                  <Icon name="map" className="size-4" />
                </span>
                <span className="ml-2 text-left">
                  <span className="block text-xs font-bold">
                    {matchedCity.name}
                  </span>
                  <span className="block text-[10px] text-muted">
                    Kabupaten/Kota • Jawa Barat
                  </span>
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-4 flex items-center gap-2">
        <span className="hidden rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-amber-700 md:block">
          DATA SIMULASI
        </span>
        <div className="relative">
          <Button
            className="gap-2 px-3"
            onClick={() => setRegionOpen((open) => !open)}
          >
            <Icon name="map" className="size-4 text-primary" />
            <span className="hidden 2xl:inline">Pilih wilayah</span>
            <Icon
              name="chevron"
              className={`size-3 transition ${regionOpen ? "rotate-90" : ""}`}
            />
          </Button>
          {regionOpen && (
            <div className="absolute right-0 top-12 w-80 rounded-2xl border border-line bg-white p-4 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="section-title">Filter Wilayah</div>
                  <div className="mt-1 text-[10px] text-muted">
                    Pilih wilayah secara bertingkat
                  </div>
                </div>
                <button
                  onClick={() => setRegionOpen(false)}
                  className="text-slate-400 hover:text-primary"
                  aria-label="Tutup filter wilayah"
                >
                  <Icon name="close" className="size-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold text-muted">
                    Provinsi
                  </span>
                  <select
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value)
                      setCity("")
                      setDistrict("")
                      setVillage("")
                    }}
                    className="h-10 w-full rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink outline-none focus:border-blue-400"
                  >
                    {provinces.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold text-muted">
                    Kabupaten / Kota
                  </span>
                  <select
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value)
                      setDistrict("")
                      setVillage("")
                    }}
                    className="h-10 w-full rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink outline-none focus:border-blue-400"
                  >
                    <option value="">Semua kabupaten / kota</option>
                    {westJavaCities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold text-muted">
                    Kecamatan
                  </span>
                  <select
                    value={district}
                    disabled={!city}
                    onChange={(event) => {
                      setDistrict(event.target.value)
                      setVillage("")
                    }}
                    className="h-10 w-full rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-400"
                  >
                    <option value="">Semua kecamatan</option>
                    <option value="kecamatan-1">Kecamatan Utara</option>
                    <option value="kecamatan-2">Kecamatan Tengah</option>
                    <option value="kecamatan-3">Kecamatan Selatan</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold text-muted">
                    Desa / Kelurahan
                  </span>
                  <select
                    value={village}
                    disabled={!district}
                    onChange={(event) => setVillage(event.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-white px-3 text-xs font-semibold text-ink outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-400"
                  >
                    <option value="">Semua desa / kelurahan</option>
                    <option value="desa-1">Desa / Kelurahan 01</option>
                    <option value="desa-2">Desa / Kelurahan 02</option>
                    <option value="desa-3">Desa / Kelurahan 03</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setProvince("jabar")
                    setCity("")
                    setDistrict("")
                    setVillage("")
                  }}
                >
                  Atur ulang
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    const selected = provinces.find(
                      (item) => item.id === province,
                    )
                    if (city) onSelectCity(city)
                    else if (selected) onSelectProvince(selected)
                    setRegionOpen(false)
                  }}
                >
                  Terapkan
                </Button>
              </div>
            </div>
          )}
        </div>
        <SelectField value={month} onChange={setMonth} icon="calendar">
          {[
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SelectField>
        <SelectField value={year} onChange={setYear}>
          <option>2025</option>
          <option>2024</option>
          <option>2023</option>
        </SelectField>
        <Button variant="primary" className="hidden gap-2 px-4 md:flex">
          <Icon name="download" className="size-4" />
          Ekspor laporan
        </Button>
      </div>
    </header>
  )
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <Icon name="info" className="size-3.5 cursor-help text-slate-400" />
      <span className="pointer-events-none absolute bottom-6 left-1/2 z-30 w-56 -translate-x-1/2 rounded-lg bg-navy px-3 py-2 text-[10px] font-medium leading-relaxed text-white opacity-0 shadow-lg transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function KpiCards({
  values,
  selected,
  setSelected,
}: {
  values: typeof nationalMetrics
  selected: MetricKey
  setSelected: (key: MetricKey) => void
}) {
  const cards = [
    {
      key: "tpk" as const,
      icon: "users" as const,
      label: "Jumlah TPK",
      note: "Tim Pendamping Keluarga",
      color: "bg-blue-50 text-blue-600",
    },
    {
      key: "anggota" as const,
      icon: "team" as const,
      label: "Anggota TPK",
      note: "3 anggota per tim",
      color: "bg-cyan-50 text-cyan-600",
    },
    {
      key: "pkb" as const,
      icon: "briefcase" as const,
      label: "PKB / PLKB",
      note: "Petugas pembina wilayah",
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      key: "krs" as const,
      icon: "family" as const,
      label: "Keluarga Berisiko Stunting",
      note: "Keluarga unik, tanpa duplikasi",
      color: "bg-amber-50 text-amber-600",
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.key}
          onClick={() => setSelected(card.key)}
          className={`group min-h-[164px] rounded-2xl border bg-white p-6 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-card ${
            selected === card.key
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-line"
          }`}
        >
          <div className="flex items-start justify-between">
            <span
              className={`grid size-10 place-items-center rounded-xl ${card.color}`}
            >
              <Icon name={card.icon} className="size-5" />
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider ${
                selected === card.key
                  ? "bg-blue-50 text-primary"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              {selected === card.key ? "Aktif" : "Pilih"}
            </span>
          </div>
          <div className="mt-4 flex min-h-8 items-start gap-1.5 text-[11px] font-bold leading-snug text-muted">
            {card.label}
            <Tooltip text={card.note} />
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-navy">
            {formatNumber(values[card.key])}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Data simulasi • perlu validasi
          </div>
        </button>
      ))}
    </div>
  )
}

function TpkWorkloadCards({
  scopeName,
  regionLevel,
  regionCode,
  stagingRegionId,
  referenceBpsCode,
  authoritativeTpkCount,
  month,
  year,
}: {
  scopeName: string
  regionLevel: RegionLevel
  regionCode: string | number
  stagingRegionId?: string
  referenceBpsCode?: string
  authoritativeTpkCount: number
  month: string
  year: string
}) {
  const normalizedKey = normalizeRegionKey(regionLevel, regionCode)
  const stagingContext = getStagingRatioContext({
    level: regionLevel,
    stagingRegionId,
    referenceBpsCode,
  })
  const record = stagingContext.record
  const validationStatus = ratioDataRequirements.stagingLoaded
    ? stagingContext.ratioStatus.replaceAll("_", " ")
    : "IMPOR DATA DIPERLUKAN"

  const cards = [
    {
      title: "Seluruh Sasaran per TPK",
      definition: indicatorSchema.keluargaSasaranPerTpk,
      status: validationStatus,
      note: stagingContext.coverageRecord
        ? "keluargaSasaran adalah SUM per desa sementara; rasio tetap null sampai numerator diperiksa ulang."
        : record
          ? "keluarga_sasaran_tercatat dan rasio staging bernilai null; menunggu deduplikasi TPKID dari sumber final."
          : "Rasio staging bernilai null dan cakupan wilayah belum dapat diperlakukan sebagai statistik lengkap.",
      color: "bg-cyan-50 text-cyan-700",
    },
    {
      title: "KRS per TPK",
      definition: indicatorSchema.keluargaBerisikoStunting,
      status: validationStatus,
      note: stagingContext.coverageRecord
        ? "krs adalah SUM per desa sementara; rasio tetap null dan KandidatAudit tidak ditampilkan."
        : record
          ? "total_prioritas dan rasio staging bernilai null; tidak dihitung sampai agregasi desa unik tervalidasi."
          : "Rasio staging bernilai null; data terbatas tidak diagregasikan sebagai angka nasional.",
      color: "bg-blue-50 text-primary",
    },
  ]

  return (
    <section className="mt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="section-title">Beban Pendampingan TPK</div>
          <Tooltip text="Rasio menggunakan KPI TPK Dashboard (COUNT DISTINCT TPKID) sebagai denominator. Rasio baru ditampilkan setelah numerator keluarga pada scope dan periode yang sama tervalidasi." />
        </div>
        <div className="text-[9px] font-semibold text-slate-400">
          {scopeName} • Periode sumber belum tersedia
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.title} className="card px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-navy">
                  {card.title}
                  <Tooltip
                    text={`Numerator: ${card.definition.numeratorColumn} dari ${card.definition.numeratorSource}; ${
                      stagingContext.coverageRecord
                        ? "nilai SUM per desa sementara tidak digunakan untuk rasio"
                        : "nilai staging null"
                    }. Aturan: ${card.definition.numeratorRule} Denominator otoritatif: ${formatNumber(authoritativeTpkCount)} TPK dari ${card.definition.denominatorSource} (${card.definition.denominatorColumn}). jml_kelompok_tpk staging tidak digunakan. Aturan: ${card.definition.denominatorRule} Filter UI: ${month} ${year}; periode sumber JSON belum tersedia dan tidak diasumsikan sama. Scope: ${scopeName} (${normalizedKey}). ID sumber: ${stagingContext.coverageRecord?.id ?? record?.id ?? "cakupan parsial"}. Status numerator: ${validationStatus}.`}
                  />
                </div>
                <div className="mt-1 text-[9px] text-muted">
                  Format setelah validasi: 1 TPK : N keluarga
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold ${card.color}`}
              >
                {card.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <span className="text-[9px] leading-relaxed text-slate-400">
                {card.note}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-1 text-[8px] font-semibold text-muted">
                Denominator KPI: {formatNumber(authoritativeTpkCount)} TPK
              </span>
            </div>
            <span className="sr-only">Kunci wilayah: {normalizedKey}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const mapPalette = ["#dbeafe", "#bfdbfe", "#93c5fd", "#3b82f6", "#1d4ed8"]
const mapNoDataColor = "#e2e8f0"

function getMapBreaks(metric: MetricKey) {
  const values = provinces
    .map((region) => region[metric])
    .sort((first, second) => first - second)
  return [0.2, 0.4, 0.6, 0.8].map(
    (quantile) =>
      values[
        Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1)
      ],
  )
}

function getMapFillExpression(metric: MetricKey) {
  const breaks = getMapBreaks(metric)
  return [
    "case",
    ["has", metric],
    [
      "step",
      ["to-number", ["get", metric]],
      mapPalette[0],
      breaks[0],
      mapPalette[1],
      breaks[1],
      mapPalette[2],
      breaks[2],
      mapPalette[3],
      breaks[3],
      mapPalette[4],
    ],
    mapNoDataColor,
  ]
}

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

function getSvgCompatibleGeoJson(data: {
  features: Array<{
    geometry?: {
      type?: string
      coordinates?: unknown
    }
    [key: string]: unknown
  }>
  [key: string]: unknown
}) {
  const normalizeRing = (ring: unknown, isOuterRing: boolean) => {
    if (!Array.isArray(ring)) return ring
    const area = ring.reduce((total, point, index) => {
      const previous = ring[index === 0 ? ring.length - 1 : index - 1]
      if (!Array.isArray(point) || !Array.isArray(previous)) return total
      return (
        total +
        Number(previous[0]) * Number(point[1]) -
        Number(point[0]) * Number(previous[1])
      )
    }, 0)
    // d3-geo uses clockwise exterior rings and counter-clockwise holes.
    const shouldBePositive = !isOuterRing
    const isPositive = area > 0
    return shouldBePositive === isPositive ? ring : [...ring].reverse()
  }

  return {
    ...data,
    features: data.features.map((feature) => {
      const geometry = feature.geometry
      if (!geometry || !Array.isArray(geometry.coordinates)) return feature

      const coordinates =
        geometry.type === "Polygon"
          ? geometry.coordinates.map((ring, index) =>
              normalizeRing(ring, index === 0),
            )
          : geometry.type === "MultiPolygon"
            ? geometry.coordinates.map((polygon) =>
                Array.isArray(polygon)
                  ? polygon.map((ring, index) =>
                      normalizeRing(ring, index === 0),
                    )
                  : polygon,
              )
            : geometry.coordinates

      return {
        ...feature,
        geometry: { ...geometry, coordinates },
      }
    }),
  }
}

function IndonesiaMap({
  metric,
  onMetric,
  onProvince,
}: {
  metric: MetricKey
  onMetric: (key: MetricKey) => void
  onProvince: (region: Region) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const metricRef = useRef(metric)
  const onProvinceRef = useRef(onProvince)
  const [mapError, setMapError] = useState(false)
  const [svgFallbackData, setSvgFallbackData] = useState<object | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapSearch, setMapSearch] = useState("")
  const [fallbackZoom, setFallbackZoom] = useState(1)
  const [fallbackCenter, setFallbackCenter] = useState<[number, number]>([
    118, -2,
  ])
  const [hovered, setHovered] = useState<{
    name: string
    code: number
    region?: Region
  } | null>(null)

  metricRef.current = metric
  onProvinceRef.current = onProvince

  useEffect(() => {
    let active = true
    let map: MapLibreMap | null = null

    const initializeMap = async () => {
      try {
        const response = await fetch("/data/indonesia-provinces.geojson")
        if (!response.ok) throw new Error("GeoJSON tidak dapat dimuat")
        const data = await response.json()
        if (
          !data ||
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Format GeoJSON tidak valid")
        }
        if (active) setSvgFallbackData(getSvgCompatibleGeoJson(data))

        if (
          !("WebGL2RenderingContext" in window) &&
          !("WebGLRenderingContext" in window)
        ) {
          throw new Error("WebGL tidak didukung")
        }

        const joinedData = {
          ...data,
          features: data.features.map(
            (feature: {
              properties?: Record<string, unknown>
              [key: string]: unknown
            }) => {
              const code = Number(feature.properties?.kode)
              const region = provinces.find(
                (province) => province.adminCode === code,
              )
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
                        anggota: region.anggota,
                        pkb: region.pkb,
                        krs: region.krs,
                      }
                    : {}),
                },
              }
            },
          ),
        }

        if (!active || !mapContainerRef.current) return

        map = new MapLibreMap({
          container: mapContainerRef.current,
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
        })
        mapRef.current = map

        map.addControl(
          new NavigationControl({
            showCompass: false,
            visualizePitch: false,
          }),
          "bottom-right",
        )
        map.addControl(
          new AttributionControl({
            compact: true,
            customAttribution: "Batas: BAKOSURTANAL / Dukcapil 2019",
          }),
          "bottom-left",
        )

        map.on("load", () => {
          if (!active || !map) return

          map.addSource("indonesia-provinces", {
            type: "geojson",
            data: joinedData,
            promoteId: "provinceCode",
            attribution: "BAKOSURTANAL / Dukcapil 2019",
          })
          map.addLayer({
            id: "province-fill",
            type: "fill",
            source: "indonesia-provinces",
            paint: {
              "fill-color": getMapFillExpression(metricRef.current) as never,
              "fill-opacity": 0.92,
            },
          })
          map.addLayer({
            id: "province-boundaries",
            type: "line",
            source: "indonesia-provinces",
            paint: {
              "line-color": "#ffffff",
              "line-width": 0.8,
              "line-opacity": 1,
            },
          })
          map.fitBounds(
            [
              [94, -11.5],
              [141.5, 6.5],
            ],
            {
              padding: { top: 20, right: 35, bottom: 20, left: 35 },
              duration: 0,
            },
          )
          setMapReady(true)
        })

        const handleHover = (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0]
          if (!feature) return
          const provinceId = String(feature.properties?.provinceId ?? "")
          const region = provinces.find(
            (province) => province.id === provinceId,
          )
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
          })
          if (map) map.getCanvas().style.cursor = region ? "pointer" : "default"
        }

        const handleMouseLeave = () => {
          setHovered(null)
          if (map) map.getCanvas().style.cursor = ""
        }

        const handleClick = (event: MapLayerMouseEvent) => {
          const provinceId = String(
            event.features?.[0]?.properties?.provinceId ?? "",
          )
          const region = provinces.find(
            (province) => province.id === provinceId,
          )
          if (region) onProvinceRef.current(region)
        }

        map.on("mousemove", "province-fill", handleHover)
        map.on("mouseleave", "province-fill", handleMouseLeave)
        map.on("click", "province-fill", handleClick)
      } catch {
        if (active) setMapError(true)
      }
    }

    initializeMap()

    return () => {
      active = false
      map?.remove()
      if (mapRef.current === map) mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer("province-fill")) return
    map.setPaintProperty(
      "province-fill",
      "fill-color",
      getMapFillExpression(metric) as never,
    )
  }, [metric])

  const filteredFallbackProvinces = provinces.filter((province) =>
    province.name.toLowerCase().includes(mapSearch.toLowerCase()),
  )
  const breaks = getMapBreaks(metric)

  return (
    <section className="card min-h-[430px] overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div>
          <div className="section-title">Sebaran Nasional</div>
          <div className="mt-1 text-xs text-muted">
            Klik provinsi untuk melihat detail wilayah
          </div>
        </div>
        <SelectField
          value={metric}
          onChange={(value) => onMetric(value as MetricKey)}
          icon="filter"
        >
          {Object.entries(metricLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="relative mt-2 min-h-[290px] overflow-hidden bg-blue-50/30 px-2 md:px-5">
        {mapError && svgFallbackData ? (
          <>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ center: [118, -2], scale: 960 }}
              width={820}
              height={300}
              className="h-[290px] w-full"
              aria-label="Peta administratif provinsi Indonesia"
            >
              <ZoomableGroup
                center={fallbackCenter}
                zoom={fallbackZoom}
                minZoom={1}
                maxZoom={4}
                onMoveEnd={({ coordinates, zoom: nextZoom }) => {
                  if (coordinates) setFallbackCenter(coordinates)
                  if (nextZoom) setFallbackZoom(nextZoom)
                }}
              >
                <Geographies geography={svgFallbackData as never}>
                  {({ geographies }) =>
                    geographies.map((geography) => {
                      const properties = geography.properties as {
                        kode?: number
                        Propinsi?: string
                      }
                      const code = Number(properties.kode)
                      const region = provinces.find(
                        (province) => province.adminCode === code,
                      )
                      const value = region?.[metric]
                      const classIndex =
                        value === undefined
                          ? -1
                          : Math.min(
                              mapPalette.length - 1,
                              breaks.findIndex(
                                (threshold) => value < threshold,
                              ) === -1
                                ? mapPalette.length - 1
                                : breaks.findIndex(
                                    (threshold) => value < threshold,
                                  ),
                            )
                      return (
                        <Geography
                          key={geography.rsmKey}
                          geography={geography}
                          fill={
                            classIndex >= 0
                              ? mapPalette[classIndex]
                              : mapNoDataColor
                          }
                          stroke="#ffffff"
                          strokeWidth={0.7}
                          className="cursor-pointer outline-none transition hover:opacity-75 focus:opacity-75"
                          onMouseEnter={() =>
                            setHovered({
                              name:
                                region?.name ??
                                String(properties.Propinsi ?? "Provinsi"),
                              code,
                              region,
                            })
                          }
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() =>
                            setHovered({
                              name:
                                region?.name ??
                                String(properties.Propinsi ?? "Provinsi"),
                              code,
                              region,
                            })
                          }
                          onBlur={() => setHovered(null)}
                          onClick={() => {
                            if (region) onProvince(region)
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${region?.name ?? properties.Propinsi ?? "Provinsi"}${
                            region
                              ? ", klik untuk membuka detail"
                              : ", data simulasi belum tersedia"
                          }`}
                        />
                      )
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
            <div className="absolute bottom-3 right-4 z-10 flex flex-col gap-1">
              <Button
                variant="icon"
                className="size-8 min-h-0 p-0 text-base"
                onClick={() =>
                  setFallbackZoom((value) => Math.min(4, value * 1.5))
                }
                aria-label="Perbesar peta"
              >
                +
              </Button>
              <Button
                variant="icon"
                className="size-8 min-h-0 p-0 text-base"
                onClick={() =>
                  setFallbackZoom((value) => Math.max(1, value / 1.5))
                }
                aria-label="Perkecil peta"
              >
                −
              </Button>
              <Button
                variant="icon"
                className="h-8 min-h-0 px-2 text-[8px]"
                onClick={() => {
                  setFallbackZoom(1)
                  setFallbackCenter([118, -2])
                }}
                aria-label="Atur ulang peta"
              >
                Reset
              </Button>
            </div>
          </>
        ) : mapError ? (
          <div className="flex min-h-[290px] flex-col items-center justify-center px-5 py-5 text-center">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-primary">
              <Icon name="map" className="size-5" />
            </span>
            <div className="mt-3 text-sm font-extrabold text-navy">
              Data peta tidak tersedia
            </div>
            <div className="mt-1 max-w-md text-[10px] leading-relaxed text-muted">
              Bentuk wilayah tidak ditampilkan karena GeoJSON administratif
              tidak dapat dimuat. Pilih provinsi dari daftar berikut.
            </div>
            <div className="mt-4 w-full max-w-sm">
              <SearchField
                compact
                value={mapSearch}
                onChange={setMapSearch}
                placeholder="Cari provinsi..."
              />
            </div>
            <div className="mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
              {filteredFallbackProvinces.map((region) => (
                <Button
                  key={region.id}
                  className="h-8 min-h-0 px-3 text-[10px]"
                  onClick={() => onProvince(region)}
                >
                  {region.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              ref={mapContainerRef}
              className="h-[290px] w-full overflow-hidden rounded-xl"
              role="application"
              aria-label="Peta choropleth administratif provinsi Indonesia"
            />
            {!mapReady && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-blue-50/80 text-xs font-semibold text-muted">
                Memuat batas administratif provinsi…
              </div>
            )}
          </>
        )}
        {hovered && (mapReady || Boolean(svgFallbackData)) && (
          <div className="pointer-events-none absolute left-1/2 top-5 z-10 min-w-48 -translate-x-1/2 rounded-xl border border-blue-100 bg-white p-3 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-extrabold text-navy">
                {hovered.name}
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-primary">
                KODE {hovered.code}
              </span>
            </div>
            {hovered.region ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1">
                  <span className="text-[9px] text-muted">Jumlah TPK</span>
                  <span className="text-right text-[10px] font-extrabold text-navy">
                    {formatNumber(hovered.region.tpk)}
                  </span>
                  <span className="text-[9px] text-muted">Anggota TPK</span>
                  <span className="text-right text-[10px] font-extrabold text-navy">
                    {formatNumber(hovered.region.anggota)}
                  </span>
                  <span className="text-[9px] text-muted">
                    Keluarga berisiko
                  </span>
                  <span className="text-right text-[10px] font-extrabold text-navy">
                    {formatNumber(hovered.region.krs)}
                  </span>
                </div>
                <div className="mt-1 text-[9px] font-semibold text-slate-400">
                  Klik untuk membuka detail provinsi
                </div>
              </>
            ) : (
              <div className="mt-2 text-[10px] text-muted">
                Data simulasi indikator belum tersedia
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-semibold text-muted">
          {mapPalette.map((color, index) => (
            <span key={color} className="flex items-center gap-1">
              <span
                className="h-2.5 w-5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span>
                {index === 0
                  ? `< ${formatCompactNumber(breaks[0])}`
                  : index === mapPalette.length - 1
                    ? `≥ ${formatCompactNumber(breaks[index - 1])}`
                    : `${formatCompactNumber(breaks[index - 1])}–${formatCompactNumber(breaks[index])}`}
              </span>
            </span>
          ))}
          <span className="ml-1 flex items-center gap-1">
            <span
              className="h-2.5 w-5 rounded-sm"
              style={{ backgroundColor: mapNoDataColor }}
            />
            Tanpa data
          </span>
        </div>
        <div className="text-[9px] text-slate-400">
          {metricLabels[metric]} • batas BAKOSURTANAL / Dukcapil 2019
        </div>
      </div>
    </section>
  )
}

function CompositionCard({
  regionName,
  total = nationalMetrics.anggota,
  simulated = false,
}: {
  regionName?: string
  total?: number
  simulated?: boolean
}) {
  return (
    <section className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="section-title">Komposisi Anggota TPK</div>
          <div className="mt-1 text-xs text-muted">
            {regionName ?? "Nasional"} • berdasarkan peran
            {simulated ? " • komposisi simulasi" : ""}
          </div>
        </div>
        <Button variant="icon" className="size-9 p-0">
          <span className="text-base leading-none">•••</span>
        </Button>
      </div>
      <div className="mt-6 flex items-center gap-6">
        <div
          className="relative size-32 shrink-0 rounded-full"
          style={{
            background:
              "conic-gradient(#155EEF 0 33.3%, #10B8CF 33.3% 66.6%, #7C8CF8 66.6% 100%)",
          }}
        >
          <div className="absolute inset-[14px] grid place-items-center rounded-full bg-white text-center">
            <div>
              <div className="text-xl font-extrabold text-navy">
                {formatNumber(total)}
              </div>
              <div className="text-[9px] font-semibold text-muted">
                TOTAL ANGGOTA
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          {memberComposition.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  {item.label}
                </span>
                <span className="font-bold text-navy">33,3%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${item.color}`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-blue-50 p-3 text-[10px] leading-relaxed text-blue-800">
        <strong>Catatan kualitas:</strong> Total anggota dihitung dari anggota
        unik setiap TPK. Angka keluarga tidak dijumlahkan ulang per anggota.
      </div>
    </section>
  )
}

function RankingCard({ onProvince }: { onProvince: (region: Region) => void }) {
  const ranked = [...provinces].sort((a, b) => b.tpk - a.tpk).slice(0, 6)
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="px-6 pt-6">
          <div className="section-title">Peringkat Provinsi</div>
          <div className="mt-1 text-xs text-muted">
            Jumlah TPK dan anggota tertinggi
          </div>
        </div>
        <span className="mr-6 mt-6 text-[10px] font-bold text-primary">
          6 provinsi teratas
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="executive-table w-full min-w-[540px] text-left">
          <thead>
            <tr className="border-y border-line bg-slate-50/70 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-2.5">Provinsi</th>
              <th className="px-3 py-2.5 text-right">Jumlah TPK</th>
              <th className="px-3 py-2.5 text-right">Anggota</th>
              <th className="px-5 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((region, index) => (
              <tr
                key={region.id}
                className="border-b border-line text-xs last:border-0 hover:bg-blue-50/60"
              >
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3 font-bold text-ink">
                    <span
                      className={`grid size-6 place-items-center rounded-lg text-[9px] font-extrabold ${
                        index < 3
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-muted"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {region.name}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-extrabold text-navy">
                  {formatNumber(region.tpk)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-muted">
                  {formatNumber(region.anggota)}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant="ghost"
                    className="h-8 min-h-0 gap-1 px-2 text-[10px] text-primary"
                    onClick={() => onProvince(region)}
                  >
                    Detail <Icon name="chevron" className="size-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PopulationIndicators({
  province,
  scopeName,
  targetValues,
}: {
  province?: Region
  scopeName?: string
  targetValues?: Partial<Record<"baduta" | "balita" | "pus" | "ibuHamil", number | string>>
}) {
  const displayTarget = (
    key: "baduta" | "balita" | "pus" | "ibuHamil",
    nationalValue: string,
  ) => {
    const value = targetValues?.[key] ?? province?.[key]
    if (typeof value === "number") return formatNumber(value)
    return value ?? nationalValue
  }
  const items = [
    {
      icon: "baby" as const,
      label: "Baduta",
      value: displayTarget("baduta", "4,82 jt"),
      sub: "Usia 0–23 bulan",
      color: "bg-violet-50 text-violet-600",
    },
    {
      icon: "child" as const,
      label: "Balita",
      value: displayTarget("balita", "14,91 jt"),
      sub: "Usia 0–59 bulan",
      color: "bg-cyan-50 text-cyan-600",
    },
    {
      icon: "couple" as const,
      label: "PUS",
      value: displayTarget("pus", "38,27 jt"),
      sub: "Pasangan usia subur",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: "mother" as const,
      label: "Ibu Hamil",
      value: displayTarget("ibuHamil", "4,91 jt"),
      sub: "Sasaran pendampingan",
      color: "bg-rose-50 text-rose-600",
    },
  ]
  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="section-title">Indikator Sasaran</div>
          <div className="mt-1 text-xs text-muted">
            Kelompok sasaran pendampingan{" "}
            {scopeName ?? province?.name ?? "nasional"}
          </div>
        </div>
        <span className="text-[9px] font-semibold text-slate-400">
          Keluarga unik • data simulasi
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="card min-h-[164px] p-5">
            <div className="flex items-center justify-between">
              <span
                className={`grid size-9 place-items-center rounded-xl ${item.color}`}
              >
                <Icon name={item.icon} className="size-[18px]" />
              </span>
              <span
                className={`size-2 rounded-full ${item.color.split(" ")[1].replace("text-", "bg-")}`}
              />
            </div>
            <div className="mt-3 text-[11px] font-semibold text-muted">
              {item.label}
            </div>
            <div className="mt-1 text-2xl font-extrabold text-navy">
              {item.value}
            </div>
            <div className="mt-1 text-[9px] text-slate-400">{item.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function EnvironmentalIndicators() {
  const items = [
    {
      icon: "water" as const,
      label: "Sumber air tidak layak",
      value: "18,4%",
    },
    {
      icon: "toilet" as const,
      label: "Jamban tidak layak",
      value: "12,7%",
    },
    {
      icon: "home" as const,
      label: "Rumah tidak layak",
      value: "9,6%",
    },
  ]
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title">Indikator Risiko Lingkungan</div>
          <div className="mt-1 text-xs text-muted">
            Persentase dari total keluarga berisiko stunting pada data simulasi
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex min-w-40 items-center gap-3 rounded-xl bg-amber-50/70 px-3 py-2.5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-amber-600">
                <Icon name={item.icon} className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-extrabold text-navy">
                  {item.value}
                </span>
                <span className="block text-[9px] font-semibold text-muted">
                  {item.label}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NationalDashboard({
  onProvince,
  month,
  year,
}: {
  onProvince: (region: Region) => void
  month: string
  year: string
}) {
  const [metric, setMetric] = useState<MetricKey>("tpk")
  const authoritativeTpk = selectAuthoritativeTpkCount({
    level: "nasional",
    regionId: "IDN",
    period: `${month} ${year}`,
  })
  const nationalKpiValues = {
    ...nationalMetrics,
    tpk: authoritativeTpk.count ?? nationalMetrics.tpk,
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Ringkasan Eksekutif</div>
          <h1 className="page-title">Dashboard Nasional</h1>
          <p className="mt-1 text-sm text-muted">
            Pemantauan cakupan Tim Pendamping Keluarga di seluruh Indonesia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted">
            Periode {month} {year}
          </span>
        </div>
      </div>
      <KpiCards
        values={nationalKpiValues}
        selected={metric}
        setSelected={setMetric}
      />
      <TpkWorkloadCards
        scopeName="Nasional"
        regionLevel="nasional"
        regionCode="IDN"
        authoritativeTpkCount={nationalKpiValues.tpk}
        month={month}
        year={year}
      />
      <div className="mt-3">
        <IndonesiaMap
          metric={metric}
          onMetric={setMetric}
          onProvince={onProvince}
        />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[3fr_2fr]">
        <RankingCard onProvince={onProvince} />
        <CompositionCard />
      </div>
      <div className="mt-4">
        <PopulationIndicators />
      </div>
      <div className="mt-3">
        <EnvironmentalIndicators />
      </div>
    </>
  )
}

function ProvinceMap({
  selectedCity,
  onCity,
  metric,
}: {
  selectedCity: string | null
  onCity: (id: string) => void
  metric: MetricKey
}) {
  const [mapData, setMapData] = useState<object | null>(null)
  const [mapError, setMapError] = useState(false)
  const [unmatchedCount, setUnmatchedCount] = useState(0)
  const [hovered, setHovered] = useState<{
    name: string
    geoId: string
    city?: typeof westJavaCities[number]
  } | null>(null)

  const metricBreaks = useMemo(() => {
    const values = westJavaCities
      .map((city) => city[metric])
      .sort((first, second) => first - second)
    const minimum = values[0]
    const interval = (values[values.length - 1] - minimum) / mapPalette.length
    return [1, 2, 3, 4].map((step) => Math.round(minimum + interval * step))
  }, [metric])

  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.BASE_URL}data/west-java-regencies.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error("GeoJSON kabupaten tidak tersedia")
        return response.json()
      })
      .then((data) => {
        if (
          !data ||
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Format GeoJSON kabupaten tidak valid")
        }
        const geoIds = data.features.map(
          (feature: { properties?: { shapeID?: string } }) =>
            feature.properties?.shapeID,
        )
        const uniqueGeoIds = new Set(geoIds.filter(Boolean))
        if (
          data.features.length !== 27 ||
          uniqueGeoIds.size !== 27 ||
          westJavaCities.some((city) => !uniqueGeoIds.has(city.geoId))
        ) {
          throw new Error("Identitas ADM2 Jawa Barat tidak valid")
        }
        if (active) {
          setUnmatchedCount(
            data.features.filter(
              (feature: { properties?: { shapeID?: string } }) =>
                !westJavaCities.some(
                  (city) => city.geoId === feature.properties?.shapeID,
                ),
            ).length,
          )
          setMapData(getSvgCompatibleGeoJson(data))
        }
      })
      .catch(() => {
        if (active) setMapError(true)
      })
    return () => {
      active = false
    }
  }, [])

  const getClassIndex = (value: number) => {
    const index = metricBreaks.findIndex((threshold) => value < threshold)
    return index === -1 ? mapPalette.length - 1 : index
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-blue-50/60 p-3">
      <div className="relative min-h-64">
        {mapError ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <div className="text-xs font-extrabold text-navy">
              Data peta kabupaten/kota tidak tersedia
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {westJavaCities.map((city) => (
                <Button
                  key={city.id}
                  className="h-8 min-h-0 px-3 text-[9px]"
                  onClick={() => onCity(city.id)}
                >
                  {city.name}
                </Button>
              ))}
            </div>
          </div>
        ) : mapData ? (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [107.6, -6.9], scale: 6800 }}
            width={440}
            height={250}
            className="h-64 w-full"
            aria-label="Peta administratif kabupaten dan kota Jawa Barat"
          >
            <Geographies geography={mapData as never}>
              {({ geographies }) =>
                geographies.map((geography) => {
                  const properties = geography.properties as {
                    shapeID?: string
                    shapeName?: string
                  }
                  const geoId = String(properties.shapeID ?? "")
                  const name = String(properties.shapeName ?? "Wilayah")
                  const city = westJavaCities.find(
                    (item) => item.geoId === geoId,
                  )
                  const selected = selectedCity === city?.id
                  return (
                    <Geography
                      key={geoId || geography.rsmKey}
                      geography={geography}
                      fill={
                        selected
                          ? "#155eef"
                          : city
                            ? mapPalette[getClassIndex(city[metric])]
                            : mapNoDataColor
                      }
                      stroke={selected ? "#102a56" : "#ffffff"}
                      strokeWidth={selected ? 1.4 : 0.7}
                      className={`outline-none transition hover:opacity-75 focus:opacity-75 ${
                        city ? "cursor-pointer" : "cursor-help"
                      }`}
                      onMouseEnter={() => setHovered({ name, geoId, city })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ name, geoId, city })}
                      onBlur={() => setHovered(null)}
                      onClick={() => {
                        if (city) onCity(city.id)
                      }}
                      tabIndex={0}
                      role={city ? "button" : "img"}
                      aria-label={`${name}${
                        city
                          ? `, ${formatNumber(city[metric])} ${metricLabels[metric]}, klik untuk detail`
                          : `, ID ${geoId}, data mock belum tersedia`
                      }`}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
        ) : (
          <div className="grid min-h-64 place-items-center">
            <div className="text-center">
              <div className="mx-auto size-7 animate-pulse rounded-full bg-blue-200" />
              <div className="mt-3 text-[10px] font-semibold text-muted">
                Memuat 27 batas kabupaten/kota…
              </div>
            </div>
          </div>
        )}
        {hovered && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 min-w-56 -translate-x-1/2 rounded-xl border border-blue-100 bg-white p-3 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-extrabold text-navy">
                {hovered.city?.name ?? hovered.name}
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold text-primary">
                ADM2
              </span>
            </div>
            {hovered.city ? (
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1">
                <span className="text-[9px] text-muted">Jumlah TPK</span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.city.tpk)}
                </span>
                <span className="text-[9px] text-muted">Anggota TPK</span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.city.anggota)}
                </span>
                <span className="text-[9px] text-muted">PKB/PLKB</span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.city.pkb)}
                </span>
                <span className="text-[9px] text-muted">Keluarga berisiko</span>
                <span className="text-right text-[10px] font-extrabold text-navy">
                  {formatNumber(hovered.city.krs)}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-[9px] leading-relaxed text-muted">
                Tanpa data mock • ID {hovered.geoId} ditandai untuk peninjauan.
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-blue-100 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-[8px] font-semibold text-muted">
          {mapPalette.map((color, index) => (
            <span key={color} className="flex items-center gap-1">
              <span
                className="h-2.5 w-4 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {index === 0
                ? `< ${formatCompactNumber(metricBreaks[0])}`
                : index === mapPalette.length - 1
                  ? `≥ ${formatCompactNumber(metricBreaks[index - 1])}`
                  : `${formatCompactNumber(metricBreaks[index - 1])}–${formatCompactNumber(metricBreaks[index])}`}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span
              className="h-2.5 w-4 rounded-sm"
              style={{ backgroundColor: mapNoDataColor }}
            />
            Tanpa Data
          </span>
        </div>
        <div className="text-[8px] text-slate-400">
          {metricLabels[metric]} • {unmatchedCount} ID tanpa data perlu ditinjau
        </div>
      </div>
    </div>
  )
}

function BogorSubdistrictMapFallback({
  selectedSubdistrict,
  onSelect,
}: {
  selectedSubdistrict: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const visibleSubdistricts = bogorSubdistricts.filter((subdistrict) =>
    subdistrict.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-col items-center text-center">
        <span className="grid size-10 place-items-center rounded-xl bg-white text-primary shadow-soft">
          <Icon name="map" className="size-5" />
        </span>
        <div className="mt-3 text-xs font-extrabold text-navy">
          Geometri ADM3 belum tersedia
        </div>
        <div className="mt-1 max-w-lg text-[10px] leading-relaxed text-muted">
          Batas kecamatan autentik yang memiliki identifier terverifikasi belum
          tersedia dari sumber geografi saat ini. Tidak ada bentuk wilayah
          sintetis yang ditampilkan.
        </div>
      </div>
      <div className="mx-auto mt-4 max-w-md">
        <SearchField
          compact
          value={search}
          onChange={setSearch}
          placeholder="Cari kecamatan Kabupaten Bogor..."
        />
      </div>
      <div className="mt-3 flex max-h-28 flex-wrap justify-center gap-1.5 overflow-y-auto pr-1">
        {visibleSubdistricts.map((subdistrict) => (
          <Button
            key={subdistrict.id}
            variant={
              selectedSubdistrict === subdistrict.id ? "primary" : "secondary"
            }
            className="h-8 min-h-0 px-2.5 text-[9px]"
            onClick={() => onSelect(subdistrict.id)}
          >
            {subdistrict.name.replace("Kecamatan ", "")}
          </Button>
        ))}
      </div>
      <div className="mt-3 text-center text-[8px] text-slate-400">
        40 kode kecamatan unik • sumber kode wilayah: API Wilayah Indonesia •
        statistik bersifat simulasi
      </div>
    </div>
  )
}

function BogorSubdistrictTable({
  selectedSubdistrict,
  onSelect,
}: {
  selectedSubdistrict: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<"tpk" | "anggota" | "pkb" | "krs">(
    "tpk",
  )
  const rows = useMemo(
    () =>
      bogorSubdistricts
        .map((subdistrict) => {
          const coverageRecord = getJawaBaratRecordByBpsCode(subdistrict.id)
          return {
            ...subdistrict,
            tpk: coverageRecord?.tpkCount ?? subdistrict.tpk,
            anggota: coverageRecord?.anggotaBaris ?? subdistrict.anggota,
            pkb: coverageRecord?.pkbNipUnik ?? subdistrict.pkb,
          }
        })
        .filter((subdistrict) =>
          subdistrict.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((first, second) => second[sortKey] - first[sortKey]),
    [search, sortKey],
  )

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <div>
          <div className="section-title">Daftar Kecamatan Kabupaten Bogor</div>
          <div className="mt-1 text-xs text-muted">
            {rows.length} dari 40 kecamatan • kode wilayah stabil
          </div>
        </div>
        <SearchField
          compact
          value={search}
          onChange={setSearch}
          placeholder="Cari kecamatan..."
        />
      </div>
      <div className="max-h-[430px] overflow-auto">
        <table className="executive-table w-full min-w-[720px] text-left">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-line text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">Kecamatan</th>
              {[
                ["tpk", "Jumlah TPK"],
                ["anggota", "Anggota"],
                ["pkb", "PKB/PLKB"],
                ["krs", "KRS"],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer px-4 py-3 text-right"
                  onClick={() =>
                    setSortKey(key as "tpk" | "anggota" | "pkb" | "krs")
                  }
                >
                  {label} ↕
                </th>
              ))}
              <th className="px-5 py-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((subdistrict) => (
              <tr
                key={subdistrict.id}
                onClick={() => onSelect(subdistrict.id)}
                className={`cursor-pointer border-b border-line text-xs transition last:border-0 hover:bg-blue-50/70 ${
                  selectedSubdistrict === subdistrict.id ? "bg-blue-50/80" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  <div className="font-bold text-ink">{subdistrict.name}</div>
                  <div className="mt-0.5 text-[9px] text-slate-400">
                    ID {subdistrict.id}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right font-extrabold text-navy">
                  {formatNumber(subdistrict.tpk)}
                </td>
                <td className="px-4 py-3.5 text-right text-muted">
                  {formatNumber(subdistrict.anggota)}
                </td>
                <td className="px-4 py-3.5 text-right text-muted">
                  {formatNumber(subdistrict.pkb)}
                </td>
                <td className="px-4 py-3.5 text-right font-semibold text-navy">
                  {formatNumber(subdistrict.krs)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button
                    variant="ghost"
                    className="h-8 min-h-0 gap-1 px-2 text-[10px] text-primary"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(subdistrict.id)
                    }}
                  >
                    Detail <Icon name="chevron" className="size-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CityTable({
  selectedCity,
  onCity,
}: {
  selectedCity: string | null
  onCity: (id: string | null) => void
}) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<"tpk" | "anggota" | "pkb" | "krs">(
    "tpk",
  )
  const cities = useMemo(
    () =>
      westJavaCities
        .filter((city) =>
          city.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => b[sortKey] - a[sortKey]),
    [search, sortKey],
  )
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
        <div>
          <div className="section-title">Peringkat Kabupaten / Kota</div>
          <div className="mt-1 text-xs text-muted">
            {cities.length} wilayah ditampilkan
          </div>
        </div>
        <div className="flex gap-2">
          {selectedCity && (
            <Button
              variant="ghost"
              className="h-10 text-xs"
              onClick={() => onCity(null)}
            >
              Hapus pilihan
            </Button>
          )}
          <SearchField
            compact
            value={search}
            onChange={setSearch}
            placeholder="Cari kabupaten/kota..."
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="executive-table w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50/70 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">Peringkat</th>
              <th className="px-4 py-3">Kabupaten / Kota</th>
              <th
                className="cursor-pointer px-4 py-3"
                onClick={() => setSortKey("tpk")}
              >
                Jumlah TPK ↕
              </th>
              <th
                className="cursor-pointer px-4 py-3"
                onClick={() => setSortKey("anggota")}
              >
                Anggota ↕
              </th>
              <th
                className="cursor-pointer px-4 py-3"
                onClick={() => setSortKey("pkb")}
              >
                PKB/PLKB ↕
              </th>
              <th
                className="cursor-pointer px-4 py-3"
                onClick={() => setSortKey("krs")}
              >
                KRS ↕
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city, index) => (
              <tr
                key={city.id}
                onClick={() => onCity(city.id)}
                className={`cursor-pointer border-b border-line text-xs transition last:border-0 hover:bg-blue-50/70 ${
                  selectedCity === city.id ? "bg-blue-50/80" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  <span className="grid size-6 place-items-center rounded-lg bg-blue-50 font-extrabold text-primary">
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-bold text-ink">{city.name}</td>
                <td className="px-4 py-3.5 font-semibold text-navy">
                  {formatNumber(city.tpk)}
                </td>
                <td className="px-4 py-3.5 text-muted">
                  {formatNumber(city.anggota)}
                </td>
                <td className="px-4 py-3.5 text-muted">
                  {formatNumber(city.pkb)}
                </td>
                <td className="px-4 py-3.5 font-semibold text-navy">
                  {formatNumber(city.krs)}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                      city.score > 85
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {city.score > 85 ? "Cakupan tinggi" : "Terpantau"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button
                    variant="ghost"
                    className="h-8 min-h-0 gap-1 px-2 text-[10px] text-primary"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCity(city.id)
                    }}
                  >
                    Detail <Icon name="chevron" className="size-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SupervisionCard({
  tpk,
  pkb,
  scopeName,
}: {
  tpk: number
  pkb: number
  scopeName: string
}) {
  const ratio = pkb > 0 ? (tpk / pkb).toFixed(1).replace(".", ",") : "–"
  return (
    <section className="card p-6">
      <div className="section-title">PKB/PLKB & Rasio Terhadap TPK</div>
      <div className="mt-1 text-xs text-muted">
        Kapasitas pembinaan {scopeName}
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="text-[10px] font-semibold text-muted">PKB / PLKB</div>
          <div className="mt-1 text-2xl font-extrabold text-primary">
            {formatNumber(pkb)}
          </div>
          <div className="mt-1 text-[9px] text-muted">
            PKB/PLKB unik pada data simulasi
          </div>
        </div>
        <div className="rounded-xl bg-indigo-50 p-4">
          <div className="text-[10px] font-semibold text-muted">
            Rasio Terhadap TPK
          </div>
          <div className="mt-1 text-2xl font-extrabold text-indigo-600">
            1 : {ratio}
          </div>
          <div className="mt-1 text-[9px] text-muted">
            Total TPK ÷ PKB/PLKB unik
          </div>
        </div>
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-[10px]">
          <span className="font-semibold text-muted">
            Cakupan supervisi (simulasi)
          </span>
          <span className="font-extrabold text-navy">86%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" />
        </div>
        <div className="mt-2 text-[9px] leading-relaxed text-slate-400">
          Nilai cakupan bersifat ilustratif sampai tersedia dataset penugasan
          supervisi yang menghubungkan PKB/PLKB dengan TPK.
        </div>
      </div>
    </section>
  )
}

function RiskCard({
  krsTotal,
  scopeName,
  month,
  year,
}: {
  krsTotal: number
  scopeName: string
  month: string
  year: string
}) {
  const distributedPriority = priorityData.map((item, index) => {
    const priorValues = priorityData
      .slice(0, index)
      .reduce(
        (total, priorItem) =>
          total + Math.round((krsTotal * priorItem.percent) / 100),
        0,
      )
    const value =
      index === priorityData.length - 1
        ? krsTotal - priorValues
        : Math.round((krsTotal * item.percent) / 100)
    return { ...item, value }
  })
  return (
    <section className="card p-6 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-title">Keluarga Berisiko Stunting</div>
          <div className="mt-1 text-xs text-muted">
            {scopeName} • total {formatNumber(krsTotal)} keluarga unik
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-7 lg:grid-cols-[1.3fr_.9fr]">
        <div>
          <div className="flex h-5 overflow-hidden rounded-full">
            {distributedPriority.map((item) => (
              <div
                key={item.label}
                className={item.color}
                style={{ width: `${item.percent}%` }}
              />
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {distributedPriority.map((item) => (
              <div key={item.label}>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-muted">
                  <span className={`size-2 rounded-full ${item.color}`} />
                  {item.label}
                </div>
                <div className="mt-1 text-base font-extrabold text-navy">
                  {formatNumber(item.value)}
                </div>
                <div className="text-[9px] text-slate-400">
                  {item.percent}% dari KRS
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: "water" as const,
              label: "Sumber air",
              value: "18,4%",
              note: "Tidak layak",
            },
            {
              icon: "toilet" as const,
              label: "Jamban",
              value: "12,7%",
              note: "Tidak layak",
            },
            {
              icon: "home" as const,
              label: "Rumah",
              value: "9,6%",
              note: "Tidak layak",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line p-3">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <Icon name={item.icon} className="size-4" />
              </span>
              <div className="mt-3 text-[10px] font-semibold text-muted">
                {item.label}
              </div>
              <div className="mt-0.5 text-lg font-extrabold text-navy">
                {item.value}
              </div>
              <div className="text-[9px] text-slate-400">{item.note}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-2 border-t border-line pt-4 text-[9px] leading-relaxed text-slate-400 md:grid-cols-2">
        <div>
          <strong className="text-muted">Definisi prototipe:</strong> Prioritas
          1 menunjukkan urgensi tertinggi, diikuti Prioritas 2, 3, dan 4 untuk
          pemantauan; Bukan prioritas tetap termasuk dalam total_prioritas.
          Klasifikasi ini bersifat simulasi, bukan definisi resmi.
        </div>
        <div className="md:text-right">
          Sumber: data mock terstruktur • Periode {month} {year} • Denominator:
          keluarga berisiko stunting unik, tidak diulang per anggota TPK.
        </div>
      </div>
    </section>
  )
}

function ProvinceDetail({
  province,
  onBack,
  month,
  year,
  selectedCity,
  onSelectedCityChange,
  selectedSubdistrict,
  onSelectedSubdistrictChange,
}: {
  province: Region
  onBack: () => void
  month: string
  year: string
  selectedCity: string | null
  onSelectedCityChange: (cityId: string | null) => void
  selectedSubdistrict: string | null
  onSelectedSubdistrictChange: (subdistrictId: string | null) => void
}) {
  const [metric, setMetric] = useState<MetricKey>("tpk")
  const selectedCityData = westJavaCities.find(
    (city) => city.id === selectedCity,
  )
  const selectedSubdistrictData = bogorSubdistricts.find(
    (subdistrict) => subdistrict.id === selectedSubdistrict,
  )
  const selectedCoverageRecord = selectedSubdistrictData
    ? getJawaBaratRecordByBpsCode(selectedSubdistrictData.id)
    : null
  const scopeLevel: RegionLevel = selectedSubdistrictData
    ? "kecamatan"
    : selectedCityData
      ? "kabupaten-kota"
      : "provinsi"
  const scopeRegionId =
    selectedSubdistrictData?.id ?? selectedCityData?.id ?? province.id
  const authoritativeTpk = selectAuthoritativeTpkCount({
    level: scopeLevel,
    regionId: scopeRegionId,
    period: `${month} ${year}`,
  })
  const metrics = {
    tpk:
      authoritativeTpk.count ??
      selectedSubdistrictData?.tpk ??
      selectedCityData?.tpk ??
      province.tpk,
    anggota:
      selectedSubdistrictData?.anggota ??
      selectedCityData?.anggota ??
      province.anggota,
    pkb:
      selectedCoverageRecord?.pkbNipUnik ??
      selectedSubdistrictData?.pkb ??
      selectedCityData?.pkb ??
      province.pkb,
    krs: selectedSubdistrictData?.krs ?? selectedCityData?.krs ?? province.krs,
  }
  const hasCountyData = province.id === "jabar"
  const isBogor = selectedCityData?.id === "bogor"
  const cityScopeName = isBogor
    ? "Kabupaten Bogor"
    : (selectedCityData?.name ?? province.name)
  const scopeName = selectedSubdistrictData?.name ?? cityScopeName
  const handleCityChange = (cityId: string | null) => {
    onSelectedSubdistrictChange(null)
    onSelectedCityChange(cityId)
  }
  const handleBack = () => {
    if (selectedSubdistrictData) {
      onSelectedSubdistrictChange(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (selectedCityData) {
      handleCityChange(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    onBack()
  }
  return (
    <>
      <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold text-muted">
        <button onClick={onBack} className="hover:text-primary">
          Nasional
        </button>
        <Icon name="chevron" className="size-3" />
        <button
          onClick={() => handleCityChange(null)}
          className={selectedCityData ? "hover:text-primary" : "text-primary"}
        >
          {province.name}
        </button>
        {selectedCityData && (
          <>
            <Icon name="chevron" className="size-3" />
            {selectedSubdistrictData ? (
              <button
                onClick={() => onSelectedSubdistrictChange(null)}
                className="hover:text-primary"
              >
                {cityScopeName}
              </button>
            ) : (
              <span className="text-primary">{cityScopeName}</span>
            )}
            {selectedSubdistrictData && (
              <>
                <Icon name="chevron" className="size-3" />
                <span className="text-primary">
                  {selectedSubdistrictData.name}
                </span>
              </>
            )}
          </>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">
            {selectedSubdistrictData
              ? "Detail Kecamatan"
              : selectedCityData
                ? "Detail Kabupaten / Kota"
                : "Detail Provinsi"}
          </div>
          <h1 className="page-title">{scopeName}</h1>
          <p className="mt-1 text-sm text-muted">
            {selectedSubdistrictData
              ? `Ringkasan simulasi ${selectedSubdistrictData.name}, Kabupaten Bogor.`
              : selectedCityData
                ? `Ringkasan simulasi wilayah ${cityScopeName}, Jawa Barat.`
                : "Ringkasan cakupan dan sasaran pendampingan tingkat kabupaten/kota."}
          </p>
        </div>
        <Button onClick={handleBack} className="gap-2 px-4">
          <Icon name="arrow" className="size-4" />
          {selectedSubdistrictData
            ? "Kembali ke Kabupaten Bogor"
            : selectedCityData
              ? `Kembali ke ${province.name}`
              : "Kembali ke nasional"}
        </Button>
      </div>
      {hasCountyData && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[9px] font-bold text-muted shadow-soft">
          <span className="text-primary">Provinsi</span>
          <Icon name="chevron" className="size-3" />
          <span className={selectedCityData ? "text-primary" : ""}>
            Kabupaten / Kota
          </span>
          <Icon name="chevron" className="size-3 text-slate-300" />
          <span
            className={
              selectedSubdistrictData ? "text-primary" : "text-slate-400"
            }
          >
            Kecamatan
          </span>
          <Icon name="chevron" className="size-3 text-slate-300" />
          <span className="text-slate-400">Desa / Kelurahan</span>
          <span className="ml-auto font-medium text-slate-400">
            Struktur siap untuk drill-down lanjutan
          </span>
        </div>
      )}
      <KpiCards values={metrics} selected={metric} setSelected={setMetric} />
      <TpkWorkloadCards
        scopeName={scopeName}
        regionLevel={scopeLevel}
        regionCode={scopeRegionId}
        stagingRegionId={
          selectedCityData?.stagingId ?? String(province.adminCode)
        }
        referenceBpsCode={selectedSubdistrictData?.id}
        authoritativeTpkCount={metrics.tpk}
        month={month}
        year={year}
      />
      <div className="mt-4">
        <PopulationIndicators
          province={
            selectedCityData || selectedSubdistrictData ? undefined : province
          }
          scopeName={scopeName}
          targetValues={
            selectedSubdistrictData
              ? {
                  baduta: selectedSubdistrictData.baduta,
                  balita: "Data belum tersedia",
                  pus: "Data belum tersedia",
                  ibuHamil: "Data belum tersedia",
                }
              : selectedCityData
                ? {
                    baduta: selectedCityData.baduta,
                    balita: "Data belum tersedia",
                    pus: "Data belum tersedia",
                    ibuHamil: "Data belum tersedia",
                  }
                : undefined
          }
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section className="card p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="section-title">
                {isBogor
                  ? "Peta Kecamatan Kabupaten Bogor"
                  : "Peta Kabupaten / Kota"}
              </div>
              <div className="mt-1 text-xs text-muted">
                {isBogor
                  ? "Pilih kecamatan untuk membuka detail wilayah"
                  : "Pilih wilayah untuk melihat data terperinci"}
              </div>
            </div>
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-[9px] font-bold text-primary">
              {metricLabels[metric]}
            </span>
          </div>
          {isBogor ? (
            <BogorSubdistrictMapFallback
              selectedSubdistrict={selectedSubdistrict}
              onSelect={(subdistrictId) =>
                onSelectedSubdistrictChange(subdistrictId)
              }
            />
          ) : hasCountyData ? (
            <ProvinceMap
              selectedCity={selectedCity}
              onCity={(cityId) => handleCityChange(cityId)}
              metric={metric}
            />
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-blue-50/60 px-6 text-center">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-primary shadow-soft">
                <Icon name="map" className="size-5" />
              </span>
              <div className="mt-3 text-xs font-extrabold text-navy">
                Data batas kabupaten/kota belum tersedia
              </div>
              <div className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted">
                GeoJSON terverifikasi untuk prototipe detail saat ini hanya
                tersedia bagi Jawa Barat. Peta sintetis tidak ditampilkan.
              </div>
            </div>
          )}
        </section>
        <CompositionCard
          regionName={scopeName}
          total={metrics.anggota}
          simulated={Boolean(selectedCityData || selectedSubdistrictData)}
        />
      </div>
      {hasCountyData && (
        <>
          <div className="mt-4">
            {isBogor ? (
              <BogorSubdistrictTable
                selectedSubdistrict={selectedSubdistrict}
                onSelect={(subdistrictId) =>
                  onSelectedSubdistrictChange(subdistrictId)
                }
              />
            ) : (
              <CityTable
                selectedCity={selectedCity}
                onCity={handleCityChange}
              />
            )}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <SupervisionCard
              tpk={metrics.tpk}
              pkb={metrics.pkb}
              scopeName={scopeName}
            />
            <RiskCard
              krsTotal={metrics.krs}
              scopeName={scopeName}
              month={month}
              year={year}
            />
          </div>
        </>
      )}
    </>
  )
}

export default function App() {
  const [selectedProvince, setSelectedProvince] = useState<Region | null>(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(
    null,
  )
  const [selectedSubdistrictId, setSelectedSubdistrictId] =
    useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [month, setMonth] = useState("Juni")
  const [year, setYear] = useState("2025")
  const selectProvince = (region: Region) => {
    setSelectedProvince(region)
    setSelectedDistrictId(null)
    setSelectedSubdistrictId(null)
    setQuery("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const selectCity = (cityId: string) => {
    const westJava = provinces.find((province) => province.id === "jabar")
    if (!westJava || !westJavaCities.some((city) => city.id === cityId)) return
    setSelectedProvince(westJava)
    setSelectedDistrictId(cityId)
    setSelectedSubdistrictId(null)
    setQuery("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const back = () => {
    setSelectedProvince(null)
    setSelectedDistrictId(null)
    setSelectedSubdistrictId(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  return (
    <div className="min-h-screen bg-background text-ink">
      <Sidebar detail={Boolean(selectedProvince)} onNational={back} />
      <div className="xl:pl-64">
        <Header
          query={query}
          setQuery={setQuery}
          month={month}
          setMonth={setMonth}
          year={year}
          setYear={setYear}
          onSelectProvince={selectProvince}
          onSelectCity={selectCity}
        />
        <main className="mx-auto max-w-[1600px] px-5 py-6 md:px-8">
          {selectedProvince ? (
            <ProvinceDetail
              province={selectedProvince}
              onBack={back}
              month={month}
              year={year}
              selectedCity={selectedDistrictId}
              onSelectedCityChange={setSelectedDistrictId}
              selectedSubdistrict={selectedSubdistrictId}
              onSelectedSubdistrictChange={setSelectedSubdistrictId}
            />
          ) : (
            <NationalDashboard
              onProvince={selectProvince}
              month={month}
              year={year}
            />
          )}
          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line py-5 text-[9px] text-slate-400">
            <span>Dashboard Monitoring TPK • Kemendukbangga/BKKBN</span>
            <span>
              Seluruh angka merupakan data simulasi, bukan data resmi.
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
