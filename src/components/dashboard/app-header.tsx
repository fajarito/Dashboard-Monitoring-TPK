"use client";

import { Download, ListFilter, Menu } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { BrandMark } from "@/components/dashboard/brand-mark";
import { WilayahSearch } from "@/components/dashboard/wilayah-search";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function AppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-xl">
      <div className="flex min-h-[72px] items-center gap-3 px-5 py-3 md:px-8">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 border-line bg-white text-muted-foreground hover:border-blue-300 hover:text-primary lg:hidden"
          aria-label="Buka menu navigasi"
          aria-expanded={open}
          aria-controls="mobile-nav-sheet"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-4" />
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            id="mobile-nav-sheet"
            side="left"
            className="w-72 border-0 p-0 sm:max-w-72"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menu navigasi</SheetTitle>
            </SheetHeader>
            <AppSidebar
              className="w-full border-0"
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="lg:hidden">
          <BrandMark />
        </div>

        <WilayahSearch className="hidden min-w-0 max-w-xs flex-1 md:block 2xl:max-w-sm" />

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-amber-700 md:inline">
            DATA SIMULASI
          </span>
          <Button
            type="button"
            variant="outline"
            className="hidden h-11 gap-2 rounded-xl border-line bg-white px-3 text-ink hover:border-blue-300 hover:bg-blue-50 sm:inline-flex"
            disabled
            title="Filter wilayah bertingkat menyusul"
          >
            <ListFilter className="size-4 text-primary" aria-hidden />
            <span className="hidden text-sm font-bold 2xl:inline">
              Pilih wilayah
            </span>
          </Button>
          <Button
            type="button"
            className="hidden h-11 gap-2 rounded-xl bg-primary px-4 text-white shadow-[var(--shadow-button)] hover:bg-[var(--primary-dark)] md:inline-flex"
            disabled
            title="Ekspor akan aktif pada Fase 3"
          >
            <Download className="size-4" aria-hidden />
            Ekspor laporan
          </Button>
        </div>
      </div>

      <div className="border-t border-line px-5 py-2 md:hidden">
        <WilayahSearch compact />
      </div>
    </header>
  );
}
