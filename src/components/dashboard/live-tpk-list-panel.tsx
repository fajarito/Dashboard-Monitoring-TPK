"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  EmptyState,
  ErrorState,
} from "@/components/dashboard/data-state";
import { Button } from "@/components/ui/button";
import { useTpkList } from "@/lib/hooks/use-tpk-list";
import { formatNumber } from "@/lib/map-data";
import type { PeringkatKabupatenItem } from "@/lib/data/types";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type KabOption = { id: string; label: string };

export function LiveTpkListPanel({
  provinceSlug,
  provinsiApiId,
  initialKabupatenId = null,
  provinceName,
}: {
  provinceSlug: string;
  /** id_provinsi numerik (string). */
  provinsiApiId: string;
  initialKabupatenId?: string | null;
  provinceName: string;
}) {
  const [kabupatenId, setKabupatenId] = useState(initialKabupatenId ?? "");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setKabupatenId(initialKabupatenId ?? "");
    setPage(1);
  }, [initialKabupatenId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [kabupatenId, debouncedQ]);

  const peringkatKab = usePeringkatKabupaten(provinsiApiId);
  const kabOptions: KabOption[] = useMemo(() => {
    const items = peringkatKab.payload?.items ?? [];
    return items.map((item: PeringkatKabupatenItem) => ({
      id: item.id,
      label: item.nama,
    }));
  }, [peringkatKab.payload]);

  const list = useTpkList({
    provinsiId: provinsiApiId,
    kabupatenId: kabupatenId || null,
    q: debouncedQ,
    page,
    pageSize: PAGE_SIZE,
  });

  const source = list.payload?.meta.source ?? null;
  const badge =
    source === "postgres"
      ? { label: "Data live", className: "bg-emerald-50 text-emerald-700" }
      : source === "mock"
        ? { label: "Data simulasi", className: "bg-amber-50 text-amber-700" }
        : null;

  return (
    <div className="design-card space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="section-title">Daftar TPK</div>
          <p className="mt-1 text-xs text-muted-foreground">
            {provinceName}
            {kabupatenId
              ? ` · filter kab/kota id ${kabupatenId}`
              : " · seluruh provinsi"}
            {" — "}
            paging server, tanpa unduh penuh.
          </p>
        </div>
        {badge ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px] flex-1 space-y-1.5">
          <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
            Cari nama TPK
          </span>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Contoh: Sukamaju"
              className="h-10 w-full rounded-xl border border-line bg-white pr-3 pl-10 text-sm font-semibold text-navy outline-none ring-primary/30 focus:ring-2"
            />
          </div>
        </label>
        <label className="min-w-[200px] flex-1 space-y-1.5">
          <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
            Kabupaten/Kota
          </span>
          <select
            value={kabupatenId}
            onChange={(e) => setKabupatenId(e.target.value)}
            className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-navy outline-none ring-primary/30 focus:ring-2"
          >
            <option value="">Semua kab/kota</option>
            {kabOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.status === "error" ? (
        <ErrorState
          title="Gagal memuat daftar TPK"
          description={list.error ?? "Periksa koneksi atau coba lagi."}
          onRetry={list.refetch}
        />
      ) : null}

      {list.status === "loading" || list.status === "idle" ? (
        <div className="space-y-2" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : null}

      {list.status === "ready" && list.payload ? (
        list.payload.items.length === 0 ? (
          <EmptyState
            title="Tidak ada TPK"
            description="Tidak ada TPK aktif untuk filter ini. Ubah kab/kota atau kata kunci."
            action={
              kabupatenId || query ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => {
                    setKabupatenId("");
                    setQuery("");
                  }}
                >
                  Reset filter
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                <thead className="bg-slate-50 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Nama TPK</th>
                    <th className="px-3 py-2.5">Wilayah</th>
                    <th className="px-3 py-2.5 text-right">Anggota</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {list.payload.items.map((item) => {
                    const wilayah = [
                      item.namaKelurahan,
                      item.namaKecamatan,
                      item.namaKabupaten,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <tr
                        key={item.tpkId}
                        className="border-t border-line hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3">
                          <div className="font-bold text-navy">
                            {item.nama ?? `TPK ${item.tpkId}`}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {item.tpkId}
                            {item.nomorRegister
                              ? ` · reg ${item.nomorRegister}`
                              : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {wilayah || "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-navy">
                          {formatNumber(item.jumlahAnggota)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Link
                            href={`/wilayah/${provinceSlug}/tpk/${encodeURIComponent(item.tpkId)}`}
                            className="text-[11px] font-bold text-primary hover:underline"
                          >
                            Detail
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <p className="text-[11px] text-muted-foreground">
                Menampilkan{" "}
                <span className="font-bold text-navy">
                  {list.payload.items.length}
                </span>{" "}
                dari{" "}
                <span className="font-bold text-navy">
                  {formatNumber(list.payload.total)}
                </span>{" "}
                TPK · halaman {list.payload.page}/
                {Math.max(1, list.payload.totalPages)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  disabled={
                    list.payload.totalPages === 0 ||
                    page >= list.payload.totalPages
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}
