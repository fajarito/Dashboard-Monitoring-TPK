"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, MapPinned } from "lucide-react";

import {
  EmptyState,
  ErrorState,
  LoadingState,
  type DemoUiState,
} from "@/components/dashboard/data-state";
import { GlossaryTerm } from "@/components/dashboard/glossary-term";
import type { PeringkatProvinsiItem } from "@/lib/data/types";
import { resolveSourceBadge } from "@/lib/data-source-badge";
import {
  estimateDesaForProvince,
  formatNumber,
  formatRatioValue,
  getDesaPerPkbRatio,
  getKrsPerTpkRatio,
  PKB_DESA_IDEAL_MAX,
  provinces,
  type Province,
} from "@/lib/map-data";
import { getKeluargaSasaranForProvince } from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

type RowModel = {
  province: Province;
  rank: number;
  keluargaSasaran: number;
  desa: number;
  krsPerTpk: number;
  desaPerPkb: number;
  bebanBerat: boolean;
};

type HoverState = {
  row: RowModel;
  top: number;
  left: number;
};

function mergeProvinceWithRanking(
  base: Province,
  item?: PeringkatProvinsiItem,
): Province {
  if (!item) return base;
  return {
    ...base,
    name: item.nama || base.name,
    tpk: item.tpk,
    krs: item.krs,
  };
}

function resolveProvinceBase(item: PeringkatProvinsiItem): Province | null {
  const byId = provinces.find((entry) => entry.id === item.id);
  if (byId) return byId;
  // Live SQL memakai kode BPS (adminCode) sebagai id string, mis. "32".
  const code = Number.parseInt(item.id, 10);
  if (Number.isFinite(code) && code > 0) {
    return provinces.find((entry) => entry.adminCode === code) ?? null;
  }
  return null;
}

export function ProvinceSebaranTable({
  compact = false,
  selectedId = null,
  onSelect,
  demoState = "ready",
  onRetryDemo,
  ranking = null,
  dataSource = null,
}: {
  /** Lebar kolom lebih sempit untuk layout berdampingan dengan kartu. */
  compact?: boolean;
  selectedId?: string | null;
  /** Klik baris → sorot di peta (tanpa navigasi wajib). */
  onSelect?: (province: Province) => void;
  demoState?: DemoUiState;
  onRetryDemo?: () => void;
  /** Dari GET /api/peringkat/provinsi — max 40; tanpa fallback mock lokal. */
  ranking?: PeringkatProvinsiItem[] | null;
  /** Sumber efektif dari meta.source API. */
  dataSource?: "mock" | "postgres" | "postgres-error" | null;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const rows = useMemo(() => {
    if (!ranking || ranking.length === 0) return [];

    return ranking.slice(0, 40).map((item, index): RowModel => {
      const base = resolveProvinceBase(item);
      const province = base
        ? mergeProvinceWithRanking(base, item)
        : ({
            id: item.id,
            adminCode: Number.parseInt(item.id, 10) || 0,
            name: item.nama,
            capital: "",
            tpk: item.tpk,
            anggota: 0,
            pkb: 0,
            krs: item.krs,
            baduta: 0,
            balita: 0,
            pus: 0,
            ibuHamil: 0,
          } satisfies Province);
      const desa = estimateDesaForProvince(province);
      const krsPerTpk =
        item.rasio ?? getKrsPerTpkRatio(province.tpk, province.krs);
      const desaPerPkb = getDesaPerPkbRatio(province.pkb, desa);
      return {
        province,
        rank: index + 1,
        keluargaSasaran: getKeluargaSasaranForProvince(province),
        desa,
        krsPerTpk,
        desaPerPkb,
        bebanBerat: desaPerPkb > PKB_DESA_IDEAL_MAX,
      };
    });
  }, [ranking]);

  const sourceBadge = resolveSourceBadge(dataSource);

  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current[selectedId];
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  function showPopover(row: RowModel, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const width = 288;
    const popHeight = 220;
    const left = Math.min(
      Math.max(12, rect.left + 72),
      window.innerWidth - width - 12,
    );
    const below = rect.bottom + 8;
    const top =
      below + popHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - popHeight - 8)
        : below;
    setHover({ row, top, left });
  }

  return (
    <section
      className={cn(
        "design-card overflow-hidden",
        compact && "lg:max-h-[720px] lg:flex lg:flex-col",
      )}
      aria-label="Tabel sebaran TPK per provinsi"
    >
      <div
        className={cn(
          "flex flex-wrap items-end justify-between gap-3 border-b border-line",
          compact ? "px-5 py-4" : "px-6 py-5",
        )}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            Peringkat sebaran
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {compact
              ? "TPK terbanyak · klik baris untuk sorot peta · tautan buka halaman"
              : "34 provinsi diurutkan TPK terbanyak — klik baris menyorot peta; gunakan tautan nama untuk membuka drill-down"}
          </p>
        </div>
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
          ) : null}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
            <MapPinned className="size-3.5" aria-hidden />
            {formatNumber(rows.length)} provinsi
          </span>
        </div>
      </div>

      {demoState === "loading" ? (
        <LoadingState label="Memuat peringkat sebaran…" rows={6} />
      ) : null}
      {demoState === "empty" ? (
        <EmptyState
          title="Belum ada data sebaran"
          description="Daftar peringkat provinsi masih kosong. Muat ulang atau pilih sumber data lain."
        />
      ) : null}
      {demoState === "error" ? (
        <ErrorState
          title="Gagal memuat peringkat"
          description="Tabel sebaran tidak dapat dimuat. Coba lagi untuk menampilkan 34 provinsi."
          onRetry={onRetryDemo}
        />
      ) : null}

      {demoState === "ready" ? (
      <>
      <div
        className={cn(
          "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]",
          compact && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        <table
          className={cn(
            "w-full text-left",
            compact ? "min-w-[520px]" : "min-w-[720px]",
          )}
        >
          <thead className={compact ? "sticky top-0 z-10" : undefined}>
            <tr className="border-b border-line bg-slate-50/95 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              <th
                className={cn(
                  "text-center font-extrabold",
                  compact ? "w-12 px-3 py-2.5" : "w-16 px-5 py-3",
                )}
              >
                #
              </th>
              <th className={cn("font-extrabold", compact ? "px-2 py-2.5" : "px-3 py-3")}>
                Provinsi
              </th>
              <th
                className={cn(
                  "text-right font-extrabold text-slate-500",
                  compact ? "px-2 py-2.5" : "px-3 py-3",
                )}
              >
                TPK
              </th>
              <th
                className={cn(
                  "text-right font-extrabold text-slate-500",
                  compact ? "px-2 py-2.5" : "px-3 py-3",
                )}
              >
                PKB
              </th>
              {!compact ? (
                <th className="px-3 py-3 text-right font-extrabold text-slate-500">
                  Kel. Sasaran
                </th>
              ) : null}
              <th
                className={cn(
                  "text-right font-extrabold text-slate-500",
                  compact ? "px-3 py-2.5" : "px-4 py-3",
                )}
              >
                <GlossaryTerm termId="krs" className="font-extrabold text-slate-500">
                  KRS
                </GlossaryTerm>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = `/wilayah/${row.province.id}`;
              const active = selectedId === row.province.id;
              return (
                <tr
                  key={row.province.id}
                  ref={(el) => {
                    rowRefs.current[row.province.id] = el;
                  }}
                  data-province-id={row.province.id}
                  className={cn(
                    "group cursor-pointer border-b border-line last:border-b-0 transition-colors",
                    active
                      ? "bg-blue-50/90 ring-1 ring-inset ring-blue-200"
                      : "hover:bg-blue-50/55",
                  )}
                  onMouseEnter={(e) => showPopover(row, e.currentTarget)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={(e) => showPopover(row, e.currentTarget)}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelect?.(row.province)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect?.(row.province);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={active}
                  aria-label={`Sorot ${row.province.name} di peta`}
                >
                  <td
                    className={cn(
                      "text-center",
                      compact ? "px-3 py-2.5" : "px-5 py-3",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-lg text-[11px] font-extrabold tabular-nums",
                        compact ? "size-6" : "size-7",
                        row.rank <= 3
                          ? "bg-blue-50 text-primary ring-1 ring-blue-100"
                          : "bg-slate-50 text-slate-500",
                      )}
                    >
                      {row.rank}
                    </span>
                  </td>
                  <td className={cn(compact ? "px-2 py-2.5" : "px-3 py-3")}>
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "inline-flex items-center gap-1.5 font-extrabold text-navy group-hover:text-primary",
                        compact ? "text-[13px]" : "text-sm gap-2",
                      )}
                    >
                      {row.province.name}
                      <ArrowRight
                        className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                    {!compact ? (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Ibu kota {row.province.capital}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      "text-right",
                      compact ? "px-2 py-2.5" : "px-3 py-3",
                    )}
                  >
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "font-extrabold tabular-nums tracking-tight text-navy",
                        compact ? "text-[13px]" : "text-[15px]",
                      )}
                    >
                      {formatNumber(row.province.tpk)}
                    </Link>
                  </td>
                  <td
                    className={cn(
                      "text-right font-bold tabular-nums text-slate-600",
                      compact ? "px-2 py-2.5 text-[12px]" : "px-3 py-3 text-[13px]",
                    )}
                  >
                    {formatNumber(row.province.pkb)}
                  </td>
                  {!compact ? (
                    <td className="px-3 py-3 text-right text-[13px] font-bold tabular-nums text-slate-600">
                      {formatNumber(row.keluargaSasaran)}
                    </td>
                  ) : null}
                  <td
                    className={cn(
                      "text-right",
                      compact ? "px-3 py-2.5" : "px-4 py-3",
                    )}
                  >
                    <span className="inline-flex flex-col items-end rounded-lg bg-amber-50/90 px-2 py-1">
                      <span
                        className={cn(
                          "font-extrabold tabular-nums text-navy",
                          compact ? "text-[12px]" : "text-[13px]",
                        )}
                      >
                        {formatNumber(row.province.krs)}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "border-t border-line text-[11px] text-muted-foreground",
          compact ? "px-5 py-3.5" : "px-6 py-4",
        )}
      >
        {compact
          ? "Urut TPK terbanyak · klik = sorot peta · tautan = buka halaman"
          : "Diurutkan jumlah TPK terbanyak · klik baris menyorot peta · tautan nama membuka drill-down"}
      </div>
      </>
      ) : null}

      {hover && demoState === "ready" && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-50 w-72 rounded-2xl border border-line bg-white p-3.5 shadow-[var(--shadow-card)]"
              style={{ top: hover.top, left: hover.left }}
            >
              <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
                Rasio ringkas
              </div>
              <div className="mt-0.5 text-sm font-extrabold text-navy">
                {hover.row.province.name}
              </div>
              <div className="mt-3 space-y-2">
                <PopoverStat
                  label="1 TPK"
                  value={formatNumber(Math.round(hover.row.krsPerTpk))}
                  unit="KRS"
                />
                <PopoverStat
                  label="1 PKB"
                  value={formatRatioValue(hover.row.desaPerPkb, 1)}
                  unit="desa"
                  status={
                    hover.row.bebanBerat ? (
                      <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-amber-800 uppercase">
                        Beban berat · &gt;{PKB_DESA_IDEAL_MAX}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-emerald-700 uppercase">
                        Aman · ≤{PKB_DESA_IDEAL_MAX}
                      </span>
                    )
                  }
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-[11px]">
                <div>
                  <div className="text-slate-400">Kel. Sasaran</div>
                  <div className="font-extrabold text-navy tabular-nums">
                    {formatNumber(hover.row.keluargaSasaran)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Anggota TPK</div>
                  <div className="font-extrabold text-navy tabular-nums">
                    {formatNumber(hover.row.province.anggota)}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function PopoverStat({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  status?: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
        <span className="text-right">
          <span className="text-lg font-extrabold tabular-nums text-navy">
            {value}
          </span>{" "}
          <span className="text-[11px] font-semibold text-slate-400">
            {unit}
          </span>
        </span>
      </div>
      {status ? <div className="mt-1.5">{status}</div> : null}
    </div>
  );
}
