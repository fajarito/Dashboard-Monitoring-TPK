"use client";

import { useState, type ReactNode } from "react";

import {
  FRESH_BLUE_GRADIENT,
  FRESH_BLUE_HERO_OVERLAY_GRADIENT,
  FRESH_BLUE_HERO_OVERLAY_PHOTO,
  type ProvinceBackground,
} from "@/lib/province-background";

type NusantaraFreshHeroProps = {
  background: ProvinceBackground;
  children: ReactNode;
  className?: string;
};

/**
 * Hero photo-first: foto = plane background penuh (object-cover),
 * konten (judul / tombol / KPI glass) di atasnya.
 * Overlay sangat ringan; tanpa wave/ornamen.
 */
export function NusantaraFreshHero({
  background,
  children,
  className = "",
}: NusantaraFreshHeroProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto =
    Boolean(background.imageUrl) && failedUrl !== background.imageUrl;

  const creditLine = background.photoCredit
    ? background.license
      ? `Foto: ${background.photoCredit} (${background.license})`
      : `Foto: ${background.photoCredit}`
    : null;

  return (
    <div
      className={`nusantara-fresh-hero relative isolate overflow-hidden ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
    >
      {/* Plane background penuh — edge-to-edge, bukan inset card */}
      {showPhoto && background.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="nusantara-fresh-hero__photo pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
          onError={() => setFailedUrl(background.imageUrl)}
        />
      ) : (
        <div
          className="nusantara-fresh-hero__surface absolute inset-0 z-0"
          style={{ backgroundImage: FRESH_BLUE_GRADIENT }}
          aria-hidden
        />
      )}

      <div
        className="nusantara-fresh-hero__overlay absolute inset-0 z-[1]"
        style={{
          backgroundImage: showPhoto
            ? FRESH_BLUE_HERO_OVERLAY_PHOTO
            : FRESH_BLUE_HERO_OVERLAY_GRADIENT,
        }}
        aria-hidden
      />

      <div className="relative z-[2] flex min-h-[min(100%,420px)] flex-col justify-between gap-5 px-4 py-6 sm:min-h-[480px] sm:px-6 sm:py-8 lg:min-h-[540px] lg:px-8">
        {(background.isAiMockup || !background.isVerified) && showPhoto ? (
          <div className="pointer-events-none absolute top-4 right-4 z-[3] sm:top-6 sm:right-6">
            <span className="inline-flex items-center rounded-full border border-white/50 bg-white/75 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#607C9D] shadow-sm backdrop-blur-sm">
              Placeholder visual - bukan foto dokumenter
            </span>
          </div>
        ) : null}

        <div className="nusantara-fresh-hero__content flex min-h-0 flex-1 flex-col justify-between gap-6">
          {children}
        </div>

        {showPhoto && (creditLine || background.isAiMockup) ? (
          <p
            className="shrink-0 text-[10px] font-medium text-[#15315D]"
            style={{ textShadow: "0 1px 0 rgba(255,255,255,0.9)" }}
          >
            {background.isAiMockup
              ? "Visual AI untuk prototyping - belum diverifikasi sebagai lokasi nyata. "
              : null}
            {creditLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
