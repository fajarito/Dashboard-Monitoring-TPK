import type { Metadata } from "next";

import { KomposisiTpkCard } from "@/components/dashboard/komposisi-tpk-card";
import { navItems } from "@/lib/navigation";
import { formatNumber, nationalTotals } from "@/lib/map-data";

const page = navItems.find((item) => item.href === "/komposisi")!;

export const metadata: Metadata = {
  title: page.title,
};

export default function KomposisiPage() {
  return (
    <section className="animate-content-enter space-y-5">
      <div>
        <div className="eyebrow">Fase 2 · Tim pendamping</div>
        <h1 className="page-title">Komposisi Tim</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lihat susunan anggota Tim Pendamping Keluarga menurut tiga pilar
          peran — agar pimpinan cepat paham siapa yang ada di lapangan.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatChip
          label="Total anggota TPK"
          value={formatNumber(nationalTotals.anggota)}
          hint="Nasional · simulasi"
        />
        <StatChip
          label="Jumlah TPK"
          value={formatNumber(nationalTotals.tpk)}
          hint="Tim di seluruh wilayah"
        />
        <StatChip
          label="Koordinator PKB/PLKB"
          value={formatNumber(nationalTotals.pkb)}
          hint="Pembina lapangan"
        />
      </div>

      <KomposisiTpkCard variant="full" />
    </section>
  );
}

function StatChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="design-card px-5 py-5 sm:px-6 sm:py-6">
      <div className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight text-navy tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">{hint}</div>
    </div>
  );
}
