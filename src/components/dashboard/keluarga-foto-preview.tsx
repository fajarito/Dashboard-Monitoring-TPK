"use client";

import { Home, ImageOff, ShowerHead, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type KeluargaFotoKind = "jamban" | "rumah";

const fotoMeta: Record<
  KeluargaFotoKind,
  { label: string; shortLabel: string; icon: typeof Home }
> = {
  jamban: {
    label: "Foto Jamban Tidak Layak",
    shortLabel: "Jamban",
    icon: ShowerHead,
  },
  rumah: {
    label: "Foto Rumah Tampak Depan",
    shortLabel: "Rumah",
    icon: Home,
  },
};

export function KeluargaFotoAction({
  kind,
  url,
  keluargaName,
  onOpen,
}: {
  kind: KeluargaFotoKind;
  url: string | null;
  keluargaName: string;
  onOpen: (payload: {
    kind: KeluargaFotoKind;
    url: string | null;
    keluargaName: string;
  }) => void;
}) {
  const meta = fotoMeta[kind];
  const Icon = meta.icon;
  const hasFoto = Boolean(url);
  const title = hasFoto
    ? `Lihat ${meta.label}`
    : `${meta.label} — Belum ada foto`;

  return (
    <button
      type="button"
      onClick={() => onOpen({ kind, url, keluargaName })}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-xl border transition-colors",
        hasFoto
          ? kind === "jamban"
            ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100"
          : "border-line bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-400",
      )}
      title={title}
      aria-label={`${title} — Kel. ${keluargaName}`}
    >
      <Icon className="size-3.5" aria-hidden />
    </button>
  );
}

export function KeluargaFotoModal({
  open,
  kind,
  url,
  keluargaName,
  onClose,
}: {
  open: boolean;
  kind: KeluargaFotoKind | null;
  url: string | null;
  keluargaName: string;
  onClose: () => void;
}) {
  if (!open || !kind) return null;

  const meta = fotoMeta[kind];
  const hasFoto = Boolean(url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keluarga-foto-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]"
        aria-label="Tutup preview foto"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
              Dokumentasi lapangan
            </div>
            <h2
              id="keluarga-foto-title"
              className="mt-1 text-base font-extrabold tracking-tight text-navy"
            >
              {meta.label}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Kel. {keluargaName}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-xl border-line"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="bg-slate-50 p-5 sm:p-6">
          {hasFoto && url ? (
            <div className="overflow-hidden rounded-xl border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${meta.label} — Kel. ${keluargaName}`}
                className="aspect-[4/3] w-full object-cover"
              />
              <p className="px-3 py-2 text-[11px] text-slate-400">
                Preview placeholder — foto resmi akan ditampilkan nanti.
              </p>
            </div>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-white px-6 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <ImageOff className="size-5" aria-hidden />
              </span>
              <div className="text-sm font-extrabold text-navy">
                Belum ada foto
              </div>
              <p className="max-w-xs text-[12px] leading-relaxed text-muted-foreground">
                {meta.label} untuk keluarga ini belum diunggah. Nanti akan
                ditampilkan di sini setelah data tersedia.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
