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
 * True page background — BUKAN hero card.
 * Foto absolute cover di wrapper section (tanpa border/radius/shadow),
 * konten children di atasnya; soft fade ke #F8FBFF di bawah.
 *
 * Negative margin mengompensasi padding <main> agar edge-to-edge
 * di pane konten (bukan inset panel).
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
    <section
      className={`nusantara-page-bg relative isolate ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
      aria-label="Latar halaman Peta Sebaran"
    >
      {/* Layer foto — full bleed wrapper, zero radius */}
      <div className="nusantara-page-bg__media pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {showPhoto && background.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={background.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="nusantara-page-bg__photo absolute inset-0 h-full w-full object-cover object-[center_18%]"
            onError={() => setFailedUrl(background.imageUrl)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: FRESH_BLUE_GRADIENT }}
          />
        )}
        <div
          className="nusantara-page-bg__fade absolute inset-0"
          style={{
            backgroundImage: showPhoto
              ? FRESH_BLUE_HERO_OVERLAY_PHOTO
              : FRESH_BLUE_HERO_OVERLAY_GRADIENT,
          }}
        />
      </div>

      {/* Konten biasa di atas background — padding = main shell */}
      <div className="nusantara-page-bg__content relative z-[1] flex flex-col gap-5 px-5 pb-12 pt-6 sm:gap-6 md:px-8 md:pb-14 md:pt-6">
        {(background.isAiMockup || !background.isVerified) && showPhoto ? (
          <div className="pointer-events-none absolute top-5 right-5 z-[2] md:top-6 md:right-8">
            <span className="inline-flex items-center rounded-full border border-white/55 bg-white/70 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#607C9D] shadow-sm backdrop-blur-sm">
              Placeholder visual - bukan foto dokumenter
            </span>
          </div>
        ) : null}

        {children}

        {showPhoto && (creditLine || background.isAiMockup) ? (
          <p
            className="text-[10px] font-medium text-[#607C9D]"
            style={{ textShadow: "0 1px 0 rgba(255,255,255,0.85)" }}
          >
            {background.isAiMockup
              ? "Visual AI untuk prototyping - belum diverifikasi sebagai lokasi nyata. "
              : null}
            {creditLine}
          </p>
        ) : null}
      </div>
    </section>
  );
}
