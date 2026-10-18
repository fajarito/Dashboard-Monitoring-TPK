"use client";

import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DemoUiState = "ready" | "loading" | "empty" | "error";

export function parseDemoState(
  value: string | null | undefined,
): DemoUiState {
  if (value === "loading" || value === "empty" || value === "error") {
    return value;
  }
  return "ready";
}

export function LoadingState({
  label = "Memuat data…",
  className,
  rows = 4,
}: {
  label?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <div
      className={cn("space-y-3 p-6", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
        <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden />
        {label}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-xl bg-slate-100"
            style={{ opacity: 1 - index * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Belum ada data",
  description = "Data untuk tampilan ini masih kosong. Coba ubah filter atau pilih wilayah lain.",
  className,
  action,
}: {
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
      role="status"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-line">
        <Inbox className="size-5" aria-hidden />
      </span>
      <div>
        <div className="text-sm font-extrabold text-navy">{title}</div>
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Gagal memuat data",
  description = "Terjadi gangguan saat mengambil data. Periksa koneksi lalu coba lagi.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <div>
        <div className="text-sm font-extrabold text-navy">{title}</div>
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-xl border-line"
          onClick={onRetry}
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid min-h-[360px] place-items-center bg-gradient-to-br from-blue-50/80 via-white to-slate-50 md:min-h-[420px]",
        className,
      )}
      role="status"
      aria-label="Menyiapkan peta"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden />
        <div className="text-xs font-semibold text-muted-foreground">
          Menyiapkan peta nasional…
        </div>
        <div className="mt-1 h-2 w-40 animate-pulse rounded-full bg-blue-100" />
      </div>
    </div>
  );
}
