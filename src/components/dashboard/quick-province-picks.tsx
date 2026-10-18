"use client";

import Link from "next/link";

import { provinces } from "@/lib/map-data";
import { cn } from "@/lib/utils";

/** Top N provinsi by TPK — pill cepat di bawah peta. */
const QUICK_PICK_COUNT = 8;

export function QuickProvincePicks({
  selectedId = null,
  onSelect,
}: {
  selectedId?: string | null;
  /** Jika ada: klik pill menyorot (sinkron peta/tabel). Tanpa ini: langsung ke halaman provinsi. */
  onSelect?: (provinceId: string) => void;
}) {
  const picks = provinces
    .slice()
    .sort((a, b) => b.tpk - a.tpk || a.name.localeCompare(b.name, "id"))
    .slice(0, QUICK_PICK_COUNT);

  return (
    <section
      className="design-card px-5 py-5 sm:px-6 sm:py-6"
      aria-label="Pilih provinsi cepat"
    >
      <div className="text-xs font-bold text-navy">Atau pilih provinsi cepat</div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {onSelect
          ? "Klik untuk menyorot di peta & tabel · tautan membuka halaman provinsi"
          : "Klik untuk membuka halaman provinsi"}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {picks.map((province) => {
          const active = selectedId === province.id;
          if (onSelect) {
            return (
              <div key={province.id} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelect(province.id)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3.5 text-[11px] font-semibold transition-colors",
                    active
                      ? "border-primary bg-blue-50 text-primary ring-2 ring-blue-100"
                      : "border-line bg-white text-ink hover:border-blue-300 hover:bg-blue-50 hover:text-primary",
                  )}
                  aria-pressed={active}
                >
                  {province.name}
                </button>
                <Link
                  href={`/wilayah/${province.id}`}
                  className="inline-flex size-8 items-center justify-center rounded-full border border-transparent text-[11px] font-bold text-primary hover:border-blue-200 hover:bg-blue-50"
                  aria-label={`Buka ${province.name}`}
                  title={`Buka ${province.name}`}
                >
                  →
                </Link>
              </div>
            );
          }
          return (
            <Link
              key={province.id}
              href={`/wilayah/${province.id}`}
              className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3.5 text-[11px] font-semibold text-ink transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-primary"
            >
              {province.name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
