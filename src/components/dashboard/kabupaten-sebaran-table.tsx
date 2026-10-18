"use client";

import { formatNumber } from "@/lib/map-data";
import type { PeringkatKabupatenItem } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  ErrorState,
  type DemoUiState,
} from "@/components/dashboard/data-state";

type Props = {
  items: PeringkatKabupatenItem[] | null;
  selectedId: string | null;
  onSelect: (item: PeringkatKabupatenItem) => void;
  onClearKab: () => void;
  provinceName: string;
  demoState: DemoUiState;
  onRetry?: () => void;
  dataSource?: string | null;
};

/** Tabel ranking kab/kota dalam provinsi — klik untuk filter ringkasan. */
export function KabupatenSebaranTable({
  items,
  selectedId,
  onSelect,
  onClearKab,
  provinceName,
  demoState,
  onRetry,
  dataSource,
}: Props) {
  if (demoState === "error") {
    return (
      <div className="design-card p-5">
        <ErrorState
          title="Gagal memuat daftar kabupaten/kota"
          description="Peringkat kab/kota tidak dapat dimuat. Coba lagi."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (demoState === "empty" || (!items?.length && demoState === "ready")) {
    return (
      <div className="design-card p-5">
        <EmptyState
          title="Belum ada kabupaten/kota"
          description={`Tidak ada data kab/kota untuk ${provinceName}.`}
        />
      </div>
    );
  }

  const loading = demoState === "loading";

  return (
    <div className="design-card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-5">
        <div>
          <div className="section-title">Kabupaten/Kota · {provinceName}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Klik baris untuk memfilter KPI ke tingkat kab/kota
            {dataSource === "postgres"
              ? " (live)"
              : dataSource === "mock"
                ? " (simulasi)"
                : ""}
          </p>
        </div>
        {selectedId ? (
          <button
            type="button"
            onClick={onClearKab}
            className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-extrabold tracking-wider text-navy uppercase hover:bg-slate-200"
          >
            Hapus filter kab
          </button>
        ) : null}
      </div>

      <div className="mt-3 max-h-[360px] overflow-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
          <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-extrabold">Kabupaten/Kota</th>
              <th className="px-3 py-2.5 text-right font-extrabold">TPK</th>
              <th className="px-3 py-2.5 text-right font-extrabold">PKB</th>
              <th className="px-3 py-2.5 text-right font-extrabold">KRS</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-4 py-3" colSpan={4}>
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              : (items ?? []).map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-t border-line transition-colors",
                        active ? "bg-blue-50/80" : "hover:bg-slate-50",
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onSelect(item)}
                          className="text-left font-bold text-navy hover:text-primary"
                        >
                          {item.nama}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-navy">
                        {formatNumber(item.tpk)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatNumber(item.pkb)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatNumber(item.krs)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
