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
  /** Judul + KPI — mengambang di atas foto (tanpa bingkai). */
  children: ReactNode;
  /** Card sekunder (sasaran/rasio) di zona #F8FBFF setelah soft fade — bukan di dalam “panel foto”. */
  belowPhoto?: ReactNode;
  /** Zona peta — sibling di shell yang sama. */
  mapZone?: ReactNode;
  className?: string;
};

/**
 * True page background — BUKAN hero card / panel foto.
 *
 * Satu shell full-bleed (kompensasi padding <main>):
 * - foto hanya di belakang blok atas (judul+KPI), edge-to-edge, zero radius/border/shadow
 * - soft fade → #F8FBFF; belowPhoto + mapZone di solid yang sama (tanpa gap bingkai)
 */
export function NusantaraFreshHero({
  background,
  children,
  belowPhoto,
  mapZone,
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

  const fullBleedStyle = {
    marginLeft: "calc(-1 * var(--nusantara-main-pad-x, 2rem))",
    marginRight: "calc(-1 * var(--nusantara-main-pad-x, 2rem))",
    marginTop: "calc(-1 * var(--nusantara-main-pad-y, 1.5rem))",
    marginBottom: 0,
    width: "calc(100% + 2 * var(--nusantara-main-pad-x, 2rem))",
    maxWidth: "none",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    outline: "none",
    background: "#f8fbff",
    overflow: "visible",
  } as const;

  return (
    <div
      className={`nusantara-page-shell relative isolate ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
      aria-label="Latar halaman Peta Sebaran"
      style={fullBleedStyle}
    >
      {/*
        Blok atas: foto = background absolute HANYA di sini (bukan kartu
        penuh-tinggi). Judul+KPI mengambang; soft fade di ujung bawah blok.
      */}
      <div className="nusantara-page-shell__top relative">
        <div
          className="nusantara-page-shell__media pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
          style={{ borderRadius: 0, border: "none", boxShadow: "none" }}
        >
          {showPhoto && background.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={background.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="nusantara-page-shell__photo absolute inset-0 h-full w-full object-cover object-[center_18%]"
              style={{
                borderRadius: 0,
                objectFit: "cover",
                objectPosition: "center 18%",
              }}
              onError={() => setFailedUrl(background.imageUrl)}
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: FRESH_BLUE_GRADIENT, borderRadius: 0 }}
            />
          )}
          <div
            className="nusantara-page-shell__fade absolute inset-0"
            style={{
              backgroundImage: showPhoto
                ? FRESH_BLUE_HERO_OVERLAY_PHOTO
                : FRESH_BLUE_HERO_OVERLAY_GRADIENT,
              borderRadius: 0,
            }}
          />
        </div>

        <div className="nusantara-page-shell__content relative z-[1] flex flex-col gap-5 px-5 pb-10 pt-6 sm:gap-6 md:px-8 md:pb-12 md:pt-6">
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
      </div>

      {belowPhoto ? (
        <div className="nusantara-page-shell__below relative z-[1] space-y-2.5 px-5 pb-5 md:px-8">
          {belowPhoto}
        </div>
      ) : null}

      {mapZone ? (
        <div className="nusantara-page-shell__map relative z-[1] px-5 pb-1 md:px-8">
          {mapZone}
        </div>
      ) : null}
    </div>
  );
}
