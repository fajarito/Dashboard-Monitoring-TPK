"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  FRESH_BLUE_BG_CROSSFADE_MS,
  FRESH_BLUE_GRADIENT,
  FRESH_BLUE_HERO_OVERLAY_GRADIENT,
  FRESH_BLUE_HERO_OVERLAY_PHOTO,
  type ProvinceBackground,
} from "@/lib/province-background";

type NusantaraFreshHeroProps = {
  background: ProvinceBackground;
  /** Judul + KPI — mengambang di atas foto (tanpa bingkai). */
  children: ReactNode;
  /** Card sekunder (sasaran/rasio) di zona #F8FBFF setelah soft fade. */
  belowPhoto?: ReactNode;
  /** Zona peta — sibling di shell yang sama. */
  mapZone?: ReactNode;
  className?: string;
};

type PhotoLayer = {
  key: string;
  url: string | null;
  /** 0 = outgoing/hidden, 1 = visible */
  opacity: number;
};

/**
 * True page background — BUKAN hero card / panel foto.
 * Crossfade antar foto wilayah ~400ms; tanpa CLS; reduced-motion → instant.
 * Hanya memuat layer aktif (+ outgoing singkat) — bukan preload 39 foto.
 */
export function NusantaraFreshHero({
  background,
  children,
  belowPhoto,
  mapZone,
  className = "",
}: NusantaraFreshHeroProps) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const targetUrl =
    background.imageUrl && !failedUrls.has(background.imageUrl)
      ? background.imageUrl
      : null;
  const targetKey = `${background.code}:${targetUrl ?? "gradient"}`;

  const [layers, setLayers] = useState<PhotoLayer[]>(() => [
    {
      key: `${background.code}:${background.imageUrl ?? "gradient"}`,
      url: background.imageUrl,
      opacity: 1,
    },
  ]);
  const activeKeyRef = useRef(targetKey);
  const timersRef = useRef<{
    rafStart: number | null;
    rafFade: number | null;
    timeout: number | null;
  }>({ rafStart: null, rafFade: null, timeout: null });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (activeKeyRef.current === targetKey) return;
    activeKeyRef.current = targetKey;

    const timers = timersRef.current;
    if (timers.rafStart != null) window.cancelAnimationFrame(timers.rafStart);
    if (timers.rafFade != null) window.cancelAnimationFrame(timers.rafFade);
    if (timers.timeout != null) window.clearTimeout(timers.timeout);
    timers.rafStart = timers.rafFade = timers.timeout = null;

    // Deferred setState — hindari sync setState di body effect (lint + cascade).
    timers.rafStart = window.requestAnimationFrame(() => {
      timers.rafStart = null;
      if (reduceMotion) {
        setLayers([{ key: targetKey, url: targetUrl, opacity: 1 }]);
        return;
      }

      // Incoming opacity 0; previous tetap 1 → crossfade tanpa CLS
      setLayers((prev) => {
        const prevActive = prev.find((layer) => layer.opacity > 0) ?? prev[0];
        const kept = prevActive ? [{ ...prevActive, opacity: 1 }] : [];
        return [...kept, { key: targetKey, url: targetUrl, opacity: 0 }];
      });

      timers.rafFade = window.requestAnimationFrame(() => {
        timers.rafFade = null;
        setLayers((prev) =>
          prev.map((layer) => ({
            ...layer,
            opacity: layer.key === targetKey ? 1 : 0,
          })),
        );
        timers.timeout = window.setTimeout(() => {
          timers.timeout = null;
          setLayers((prev) => prev.filter((layer) => layer.key === targetKey));
        }, FRESH_BLUE_BG_CROSSFADE_MS + 50);
      });
    });

    return () => {
      if (timers.rafStart != null) window.cancelAnimationFrame(timers.rafStart);
      if (timers.rafFade != null) window.cancelAnimationFrame(timers.rafFade);
      if (timers.timeout != null) window.clearTimeout(timers.timeout);
      timers.rafStart = timers.rafFade = timers.timeout = null;
    };
  }, [targetKey, targetUrl, reduceMotion]);

  const showPhoto = layers.some((layer) => Boolean(layer.url));

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
    ["--nusantara-bg-crossfade" as string]: reduceMotion
      ? "0ms"
      : `${FRESH_BLUE_BG_CROSSFADE_MS}ms`,
  } as CSSProperties;

  const markFailed = (url: string | null) => {
    if (!url) return;
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  return (
    <div
      className={`nusantara-page-shell relative isolate ${className}`}
      data-region-code={background.code}
      data-bg-mode={showPhoto ? "photo" : "gradient"}
      aria-label="Latar halaman Peta Sebaran"
      style={fullBleedStyle}
    >
      <div className="nusantara-page-shell__top relative">
        <div
          className="nusantara-page-shell__media pointer-events-none absolute inset-0 z-0 overflow-hidden"
          aria-hidden
          style={{ borderRadius: 0, border: "none", boxShadow: "none" }}
        >
          {layers.map((layer) => (
            <div
              key={layer.key}
              className="nusantara-page-shell__photo-layer"
              style={{ opacity: layer.opacity }}
            >
              {layer.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={layer.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="nusantara-page-shell__photo absolute inset-0 h-full w-full object-cover object-[center_22%]"
                  style={{
                    borderRadius: 0,
                    objectFit: "cover",
                    objectPosition: "center 22%",
                  }}
                  onError={() => markFailed(layer.url)}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: FRESH_BLUE_GRADIENT,
                    borderRadius: 0,
                  }}
                />
              )}
            </div>
          ))}
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

        <div className="nusantara-page-shell__content relative z-[1] flex flex-col gap-3.5 px-5 pb-6 pt-5 sm:gap-4 md:px-8 md:pb-7 md:pt-5">
          {(background.isAiMockup || !background.isVerified) && showPhoto ? (
            <div className="pointer-events-none absolute top-4 right-5 z-[2] md:top-5 md:right-8">
              <span className="inline-flex items-center rounded-full border border-white/55 bg-white/75 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#64748B] shadow-sm backdrop-blur-sm">
                Placeholder visual - bukan foto dokumenter
              </span>
            </div>
          ) : null}

          {children}

          {showPhoto && (creditLine || background.isAiMockup) ? (
            <p
              className="text-[10px] font-medium text-[#64748B]"
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
        <div className="nusantara-page-shell__below relative z-[1] space-y-2 px-5 pb-3 pt-0.5 md:px-8 md:pb-3.5">
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
