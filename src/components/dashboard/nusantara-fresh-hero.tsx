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
 * Zona atas halaman: foto = background penuh (object-cover),
 * konten di atasnya, soft fade ke bawah menuju area peta.
 * Bukan card hero dengan wash putih merata.
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
      className={`nusantara-fresh-hero nusantara-fresh-hero--page-bg relative isolate overflow-hidden ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
    >
      {showPhoto && background.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="nusantara-fresh-hero__photo pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-[center_20%]"
          onError={() => setFailedUrl(background.imageUrl)}
        />
      ) : (
        <div
          className="nusantara-fresh-hero__surface absolute inset-0 z-0"
          style={{ backgroundImage: FRESH_BLUE_GRADIENT }}
          aria-hidden
        />
      )}

      {/* Soft bottom fade saja — bukan wash full-bleed */}
      <div
        className="nusantara-fresh-hero__overlay absolute inset-0 z-[1]"
        style={{
          backgroundImage: showPhoto
            ? FRESH_BLUE_HERO_OVERLAY_PHOTO
            : FRESH_BLUE_HERO_OVERLAY_GRADIENT,
        }}
        aria-hidden
      />

      <div className="relative z-[2] flex flex-col gap-5 px-4 pb-10 pt-6 sm:gap-6 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8 lg:pb-14">
        {(background.isAiMockup || !background.isVerified) && showPhoto ? (
          <div className="pointer-events-none absolute top-4 right-4 z-[3] sm:top-6 sm:right-6">
            <span className="inline-flex items-center rounded-full border border-white/55 bg-white/70 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#607C9D] shadow-sm backdrop-blur-sm">
              Placeholder visual - bukan foto dokumenter
            </span>
          </div>
        ) : null}

        <div className="nusantara-fresh-hero__content flex flex-col gap-5 sm:gap-6">
          {children}
        </div>

        {showPhoto && (creditLine || background.isAiMockup) ? (
          <p
            className="shrink-0 text-[10px] font-medium text-[#607C9D]"
            style={{ textShadow: "0 1px 0 rgba(255,255,255,0.85)" }}
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
