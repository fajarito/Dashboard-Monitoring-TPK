import type { DataSource } from "@/lib/data/types";
import { formatNumber } from "@/lib/map-data";

/** Kartu identitas wilayah — label jenjang + nama terpilih (bukan "Wilayah aktif"). */
export function WilayahIdentityCards({
  levelLabel,
  wilayahName,
  wilayahHint,
  childCountLabel,
  childCount,
  childCountHint,
  krs,
  dataSource = "mock",
}: {
  levelLabel: string;
  wilayahName: string;
  wilayahHint: string;
  childCountLabel: string;
  childCount: number;
  childCountHint: string;
  krs: number;
  /** meta.source API — teks hint KRS ikut live/simulasi. */
  dataSource?: DataSource | null;
}) {
  const krsHint =
    dataSource === "postgres"
      ? "Agregat live (ringkasan)"
      : dataSource === "mock"
        ? "Agregat sampel (simulasi)"
        : "Agregat wilayah";

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <MetaCard
        label={levelLabel}
        value={wilayahName}
        hint={wilayahHint}
        isText
      />
      <MetaCard
        label={childCountLabel}
        value={formatNumber(childCount)}
        hint={childCountHint}
      />
      <MetaCard
        label="KRS di wilayah ini"
        value={formatNumber(krs)}
        hint={krsHint}
      />
    </div>
  );
}

function MetaCard({
  label,
  value,
  hint,
  isText = false,
}: {
  label: string;
  value: string;
  hint: string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-5 shadow-[var(--shadow-soft)] sm:px-6 sm:py-6">
      <div className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </div>
      <div
        className={
          isText
            ? "mt-2 text-lg font-extrabold tracking-tight text-navy"
            : "mt-2 text-2xl font-extrabold tracking-tight text-navy tabular-nums"
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-slate-400">{hint}</div>
    </div>
  );
}
