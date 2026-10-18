import { Users } from "lucide-react";

import {
  PhoneStatusHint,
  TpkContactAction,
} from "@/components/dashboard/tpk-contact-action";
import type { TpkMember } from "@/lib/tpk-drilldown-data";
import { cn } from "@/lib/utils";

export function TpkMemberCards({ members }: { members: TpkMember[] }) {
  return (
    <section className="design-card p-6 sm:p-7" aria-label="Anggota TPK">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            Anggota TPK
          </h2>
          <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-muted-foreground">
            NIK, status pelatihan, dan kontak per personel
          </p>
        </div>
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-primary"
          aria-hidden
        >
          <Users className="size-4" />
        </span>
      </div>

      <ul
        className="grid gap-4 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 xl:gap-5"
        role="list"
      >
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-2xl border border-[#d0dae8] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-slate-100/80 sm:px-5 sm:py-5"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold text-primary ring-1 ring-blue-100">
                {member.name
                  .split(" ")
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-extrabold text-navy">
                    {member.name}
                  </span>
                  <span className="font-mono text-[11px] font-semibold tracking-wide text-slate-400 tabular-nums">
                    NIK {member.nik}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {member.role}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase",
                    member.trainingStatus === "Terlatih"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {member.trainingStatus}
                </span>
                <PhoneStatusHint phone={member.phone} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <TpkContactAction phone={member.phone} kind="call" size="sm" />
                <TpkContactAction
                  phone={member.phone}
                  kind="whatsapp"
                  size="sm"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
