import { APP_BRAND, APP_ORG } from "@/lib/navigation";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center rounded-xl bg-primary text-white shadow-[var(--shadow-button)]">
        <div className="grid grid-cols-2 gap-0.5" aria-hidden>
          <span className="size-2 rounded-sm bg-white" />
          <span className="size-2 rounded-sm bg-blue-200" />
          <span className="size-2 rounded-sm bg-cyan-300" />
          <span className="size-2 rounded-sm bg-white" />
        </div>
      </div>
      {!compact ? (
        <div className="min-w-0">
          <div className="truncate text-sm font-extrabold tracking-tight text-navy">
            {APP_BRAND}
          </div>
          <div className="mt-0.5 truncate text-[10px] font-semibold tracking-widest text-slate-400">
            {APP_ORG}
          </div>
        </div>
      ) : null}
    </div>
  );
}
