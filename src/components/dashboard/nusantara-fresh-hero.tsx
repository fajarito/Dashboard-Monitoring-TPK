"use client";

import { useState, type ReactNode } from "react";

import {
  FRESH_BLUE_GRADIENT,
  FRESH_BLUE_HERO_OVERLAY,
  type ProvinceBackground,
} from "@/lib/province-background";

type NusantaraFreshHeroProps = {
  background: ProvinceBackground;
  children: ReactNode;
  className?: string;
};

/**
 * Hero photo-first Fresh Blue — overlay gradient transparan saja,
 * tanpa wave/ornamen. Lazy load satu foto aktif; onError → gradient.
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
      className={`nusantara-fresh-hero relative overflow-hidden ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
    >
      <div
        className="nusantara-fresh-hero__surface absolute inset-0"
        style={{
          backgroundImage: showPhoto
            ? `url(${background.imageUrl})`
            : FRESH_BLUE_GRADIENT,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        aria-hidden
      />
      {showPhoto && background.imageUrl ? (
        // Preload / error probe — tidak merender 39 gambar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onError={() => setFailedUrl(background.imageUrl)}
        />
      ) : null}
      <div
        className="nusantara-fresh-hero__overlay absolute inset-0"
        style={{ backgroundImage: FRESH_BLUE_HERO_OVERLAY }}
        aria-hidden
      />

      <div className="relative z-[1] flex min-h-[min(100%,420px)] flex-col justify-end gap-4 px-4 py-6 sm:min-h-[460px] sm:px-6 sm:py-8 lg:min-h-[520px] lg:px-8">
        {(background.isAiMockup || !background.isVerified) && showPhoto ? (
          <div className="pointer-events-none absolute top-4 right-4 sm:top-6 sm:right-6">
            <span className="inline-flex items-center rounded-full border border-[rgba(217,230,247,0.95)] bg-white/90 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#607C9D] shadow-sm backdrop-blur-sm">
              Placeholder visual - bukan foto dokumenter
            </span>
          </div>
        ) : null}

        {children}

        {showPhoto && (creditLine || background.isAiMockup) ? (
          <p className="text-[10px] font-medium text-[#607C9D]">
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
