"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPinned, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranShortLabels,
} from "@/lib/sasaran-indikator";
import type { WilayahChildRow } from "@/lib/wilayah-hierarchy-data";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

export type WilayahChildRowWithHref = WilayahChildRow & { href: string };

export function WilayahChildTable({
  rows,
  scopeLabel,
  childLabel,
  actionLabel = "Buka",
}: {
  rows: WilayahChildRowWithHref[];
  scopeLabel: string;
  /** Mis. "Kabupaten/Kota" atau "Kecamatan". */
  childLabel: string;
  actionLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  return (
    <section
      className="design-card overflow-hidden"
      aria-label={`Daftar ${childLabel} di ${scopeLabel}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            Daftar {childLabel}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Agregat di{" "}
            <span className="font-semibold text-navy">{scopeLabel}</span> —
            klik baris untuk turun ke level berikutnya
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-primary">
          <MapPinned className="size-3.5" aria-hidden />
          {formatNumber(filtered.length)} / {formatNumber(rows.length)}{" "}
          {childLabel.toLowerCase()}
        </span>
      </div>

      <div className="border-b border-line px-6 py-4">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={`Filter nama ${childLabel.toLowerCase()}…`}
            className="h-9 w-full rounded-xl border border-line bg-white pr-3 pl-9 text-[12px] text-navy outline-none ring-primary/30 placeholder:text-slate-400 focus:ring-2"
            aria-label={`Filter daftar ${childLabel}`}
          />
        </label>
      </div>

      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[960px] text-left">
          <thead>
            <tr className="border-b border-line bg-slate-50/90 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              <th className="sticky left-0 z-10 bg-slate-50/95 px-6 py-3.5 font-extrabold backdrop-blur-sm">
                Nama wilayah
              </th>
              <th className="px-3 py-3 text-center font-extrabold text-slate-500">
                Kel. Sasaran
              </th>
              <th className="px-3 py-3 text-center font-extrabold text-slate-500">
                KRS
              </th>
              {sasaranKeys.map((key) => (
                <th
                  key={key}
                  className="px-2.5 py-3 text-center font-extrabold"
                >
                  {sasaranShortLabels[key]}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-extrabold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + sasaranKeys.length}
                  className="px-6 py-12 text-center text-sm text-muted-foreground"
                >
                  Tidak ada {childLabel.toLowerCase()} yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              pageItems.map((row) => {
                const href = row.href;
                return (
                  <tr
                    key={row.id}
                    className="group border-b border-line last:border-b-0 transition-colors hover:bg-blue-50/55"
                  >
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 group-hover:bg-blue-50/55">
                      <Link href={href} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-extrabold ring-1",
                            "bg-blue-50 text-primary ring-blue-100",
                          )}
                        >
                          {row.name
                            .replace(/^(Kota|Kabupaten|Kecamatan)\s+/i, "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-extrabold text-navy group-hover:text-primary">
                            {row.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {row.kindLabel} · {formatNumber(row.tpkCount)} TPK
                            (simulasi)
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex min-w-[2.75rem] flex-col items-center rounded-lg bg-blue-50/90 px-2 py-1">
                        <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                          {formatNumber(row.keluargaSasaran)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className="inline-flex min-w-[2.75rem] flex-col items-center rounded-lg bg-amber-50/90 px-2 py-1">
                        <span className="text-[15px] font-extrabold tabular-nums tracking-tight text-navy">
                          {formatNumber(row.krs)}
                        </span>
                        <span className="text-[8px] font-bold tracking-wider text-amber-700/80 uppercase">
                          Berisiko
                        </span>
                      </span>
                    </td>
                    {sasaranKeys.map((key) => (
                      <td
                        key={key}
                        className="px-2.5 py-3.5 text-center text-sm font-extrabold tabular-nums text-navy"
                      >
                        {formatNumber(row.sasaran[key])}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary transition-colors hover:bg-blue-50"
                        aria-label={`${actionLabel} ${row.name}`}
                      >
                        {actionLabel}
                        <ArrowRight className="size-3.5" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p className="text-[11px] text-muted-foreground">
          Menampilkan{" "}
          <span className="font-bold text-navy">
            {filtered.length === 0 ? 0 : start + 1}–
            {Math.min(start + PAGE_SIZE, filtered.length)}
          </span>{" "}
          dari{" "}
          <span className="font-bold text-navy">
            {formatNumber(filtered.length)}
          </span>
          {query ? " (terfilter)" : null}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-line"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Sebelumnya
          </Button>
          <span className="min-w-[4.5rem] text-center text-[11px] font-bold text-navy tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-line"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </section>
  );
}
