"use client";

import {
  Droplets,
  Home,
  ImageOff,
  LoaderCircle,
  ShowerHead,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useKeluargaDetail } from "@/lib/hooks/use-keluarga-detail";
import type { KeluargaDetailHousingField } from "@/lib/data/types";
import { cn } from "@/lib/utils";

function FieldRow({
  label,
  field,
}: {
  label: string;
  field: KeluargaDetailHousingField;
}) {
  const value = field.label ?? (field.code != null ? `Kode ${field.code}` : "—");
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-[12px] font-bold text-navy">
        {value}
      </span>
    </div>
  );
}

function FotoPanel({
  title,
  url,
  keluargaName,
}: {
  title: string;
  url: string | null;
  keluargaName: string;
}) {
  if (!url) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-slate-50 px-4 text-center">
        <span className="grid size-10 place-items-center rounded-2xl bg-slate-100 text-slate-400">
          <ImageOff className="size-4" aria-hidden />
        </span>
        <div className="text-[12px] font-extrabold text-navy">Belum ada foto</div>
        <p className="text-[11px] text-muted-foreground">{title}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${title} — Kel. ${keluargaName}`}
        className="aspect-[4/3] w-full object-cover bg-slate-100"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <p className="px-3 py-2 text-[11px] font-semibold text-slate-500">{title}</p>
    </div>
  );
}

export function KeluargaDetailModal({
  open,
  kki,
  provinsiId,
  fallbackNama,
  onClose,
}: {
  open: boolean;
  /** KKI — kunci join ke stunting_head (Fajar). */
  kki: string | null;
  provinsiId?: number | null;
  fallbackNama?: string | null;
  onClose: () => void;
}) {
  const { status, payload, error, refetch } = useKeluargaDetail(
    open ? kki : null,
    provinsiId,
  );

  if (!open || !kki) return null;

  const item = payload?.item;
  const titleName =
    item?.namaKepalaKeluarga ?? fallbackNama?.trim() ?? "Detail keluarga";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keluarga-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]"
        aria-label="Tutup detail keluarga"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-[var(--shadow-soft)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
              Detail keluarga · stunting_head
            </div>
            <h2
              id="keluarga-detail-title"
              className="mt-1 truncate text-base font-extrabold tracking-tight text-navy"
            >
              Kel. {titleName}
            </h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              KKI {item?.kki ?? kki}
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

        <div className="overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {status === "loading" || status === "idle" ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-slate-500">
              <LoaderCircle className="size-6 animate-spin text-primary" />
              <p className="text-[12px] font-semibold">Memuat detail keluarga…</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-extrabold text-navy">Gagal memuat detail</p>
              <p className="max-w-sm text-[12px] text-muted-foreground">
                {error ?? "Terjadi kesalahan."}
              </p>
              <Button type="button" variant="outline" className="rounded-xl" onClick={refetch}>
                Coba lagi
              </Button>
            </div>
          ) : null}

          {status === "ready" && item ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-line bg-slate-50/80 p-4">
                <div className="text-[10px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">
                  Identitas KK
                </div>
                <dl className="mt-2 grid gap-2 text-[12px] sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Nama KK</dt>
                    <dd className="font-extrabold text-navy">{item.namaKepalaKeluarga}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">No. KK</dt>
                    <dd className="font-bold text-navy">{item.noKk ?? "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Alamat</dt>
                    <dd className="font-semibold text-navy">{item.alamat ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Prioritas</dt>
                    <dd className="font-bold text-navy">
                      {item.prioritas == null ? "—" : `P${item.prioritas}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Risiko stunting</dt>
                    <dd className="font-bold text-navy">
                      {item.risikoStunting == null
                        ? "—"
                        : item.risikoStunting
                          ? "Berisiko"
                          : "Tidak berisiko"}
                    </dd>
                  </div>
                </dl>
              </section>

              <div className="grid gap-4 sm:grid-cols-3">
                <section className="rounded-2xl border border-line p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-navy">
                    <Home className="size-3.5 text-orange-600" aria-hidden />
                    Rumah
                  </div>
                  <FieldRow label="Atap (genteng)" field={item.rumah.atap} />
                  <FieldRow label="Kondisi atap" field={item.rumah.kondisiAtap} />
                  <FieldRow label="Dinding" field={item.rumah.dinding} />
                  <FieldRow label="Kondisi dinding" field={item.rumah.kondisiDinding} />
                  <FieldRow label="Lantai" field={item.rumah.lantai} />
                  <FieldRow label="Kondisi lantai" field={item.rumah.kondisiLantai} />
                  <div className="flex justify-between gap-2 pt-2 text-[11px]">
                    <span className="text-slate-500">Luas / penghuni</span>
                    <span className="font-bold text-navy">
                      {item.rumah.luasM2 != null ? `${item.rumah.luasM2} m²` : "—"}
                      {" · "}
                      {item.rumah.jumlahPenghuni != null
                        ? `${item.rumah.jumlahPenghuni} org`
                        : "—"}
                    </span>
                  </div>
                </section>

                <section className="rounded-2xl border border-line p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-navy">
                    <ShowerHead className="size-3.5 text-amber-700" aria-hidden />
                    Jamban
                  </div>
                  <FieldRow label="Ada tempat BAB" field={item.jamban.memilikiTempatBab} />
                  <FieldRow label="Kondisi jamban" field={item.jamban.kondisi} />
                </section>

                <section className="rounded-2xl border border-line p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-extrabold text-navy">
                    <Droplets className="size-3.5 text-sky-600" aria-hidden />
                    Air minum
                  </div>
                  <FieldRow label="Sumber air" field={item.air.sumber} />
                  <FieldRow label="Kondisi sumber" field={item.air.kondisi} />
                </section>
              </div>

              <section>
                <div className="mb-2 text-[10px] font-extrabold tracking-[0.12em] text-slate-400 uppercase">
                  Foto lapangan
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FotoPanel
                    title="Foto rumah"
                    url={item.fotoRumahUrl}
                    keluargaName={item.namaKepalaKeluarga}
                  />
                  <FotoPanel
                    title="Foto jamban"
                    url={item.fotoJambanUrl}
                    keluargaName={item.namaKepalaKeluarga}
                  />
                </div>
              </section>

              {item.keterangan ? (
                <p
                  className={cn(
                    "rounded-xl border border-line bg-slate-50 px-3 py-2 text-[12px] text-slate-600",
                  )}
                >
                  {item.keterangan}
                </p>
              ) : null}

              <p className="text-[10px] text-slate-400">
                Join pin → head: <code className="font-mono">KKI</code>
                {payload?.meta.source ? ` · sumber ${payload.meta.source}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
