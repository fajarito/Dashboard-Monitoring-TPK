"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/dashboard/brand-mark";
import { Button } from "@/components/ui/button";
import {
  APP_AUDIENCE,
  APP_AUDIENCE_ROLE,
  navItems,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-line bg-sidebar px-5 py-6 text-sidebar-foreground",
        className,
      )}
    >
      <BrandMark />

      <div className="mt-9 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
        Menu utama
      </div>

      <nav className="mt-3 flex flex-1 flex-col gap-1" aria-label="Navigasi utama">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex w-full items-center gap-3 rounded-[0.875rem] px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
                active
                  ? "bg-blue-50 text-primary"
                  : "text-muted-foreground hover:bg-blue-50 hover:text-primary",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="min-w-0 truncate">{item.title}</span>
              {active ? (
                <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-gradient-to-br from-navy to-primary p-4 text-white shadow-[var(--shadow-soft)]">
        <div className="text-xs font-bold">Pusat Bantuan</div>
        <p className="mt-1 text-[11px] leading-relaxed text-blue-100">
          Butuh bantuan membaca indikator dashboard? Buka Keterangan Istilah.
        </p>
        <Button
          asChild
          className="mt-3 h-8 w-full border border-white/20 bg-white/10 text-xs text-white hover:bg-white/20"
        >
          <Link href="/istilah" onClick={onNavigate}>
            Lihat panduan
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
        <div className="grid size-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-primary">
          PP
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-ink">{APP_AUDIENCE}</div>
          <div className="text-[10px] text-muted-foreground">
            {APP_AUDIENCE_ROLE}
          </div>
        </div>
      </div>
    </aside>
  );
}
