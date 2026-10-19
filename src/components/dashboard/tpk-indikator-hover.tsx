"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { TpkListIndikator } from "@/lib/data/types";
import { formatNumber } from "@/lib/map-data";
import {
  sasaranKeys,
  sasaranShortLabels,
  type SasaranKey,
} from "@/lib/sasaran-indikator";
import { cn } from "@/lib/utils";

const SASARAN_API_KEY: Record<
  SasaranKey,
  "bumil" | "baduta" | "balita" | "jambanTL" | "airTL" | "rtlh"
> = {
  ibuHamil: "bumil",
  baduta: "baduta",
  balita: "balita",
  jambanTidakLayak: "jambanTL",
  sumberAirTidakLayak: "airTL",
  rtlh: "rtlh",
};

function formatNullableCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return formatNumber(value);
}

type Coords = { top: number; left: number };

/**
 * Hover (desktop) / tap·long-press (mobile) popover untuk 6 indikator desa.
 * Tidak menambah kolom tabel — hanya surface detail on-demand.
 */
export function TpkIndikatorHover({
  indikator,
  children,
  className,
  label = "Lihat 6 indikator desa",
}: {
  indikator: TpkListIndikator | null | undefined;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignoreClickUntil = useRef(0);
  /** Click/tap pins open until outside dismiss (ignores hover leave). */
  const pinnedRef = useRef(false);

  function placePanel() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 240;
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 12,
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - 280);
    setCoords({ top, left });
  }

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openPanel(opts?: { pinned?: boolean }) {
    clearCloseTimer();
    if (opts?.pinned) pinnedRef.current = true;
    placePanel();
    setOpen(true);
  }

  function closePanel() {
    clearCloseTimer();
    pinnedRef.current = false;
    setOpen(false);
  }

  function scheduleClose() {
    if (pinnedRef.current) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      if (!pinnedRef.current) setOpen(false);
    }, 160);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(target)) return;
      closePanel();
    }
    function onScroll() {
      placePanel();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, panelId]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      clearCloseTimer();
    };
  }, []);

  return (
    <>
      <span
        ref={triggerRef}
        className={cn(
          "relative inline-flex cursor-help outline-none",
          className,
        )}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        data-tpk-indikator-hover=""
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover)").matches) {
            openPanel();
          }
        }}
        onMouseLeave={() => {
          if (window.matchMedia("(hover: hover)").matches) {
            scheduleClose();
          }
        }}
        onFocus={() => openPanel({ pinned: true })}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          const panel = document.getElementById(panelId);
          if (panel?.contains(next)) return;
          if (triggerRef.current?.contains(next)) return;
          closePanel();
        }}
        onClick={(e) => {
          if (Date.now() < ignoreClickUntil.current) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (open && pinnedRef.current) closePanel();
          else openPanel({ pinned: true });
        }}
        onTouchStart={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = setTimeout(() => {
            ignoreClickUntil.current = Date.now() + 400;
            openPanel({ pinned: true });
          }, 420);
        }}
        onTouchEnd={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onTouchCancel={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) closePanel();
            else openPanel({ pinned: true });
          }
        }}
      >
        {children}
      </span>

      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              id={panelId}
              role="dialog"
              aria-label="Enam indikator desa"
              data-tpk-indikator-panel=""
              className="fixed z-[80] w-[240px] rounded-2xl border border-line bg-white p-3.5 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5"
              style={{ top: coords.top, left: coords.left }}
              onMouseEnter={() => {
                clearCloseTimer();
              }}
              onMouseLeave={() => {
                if (window.matchMedia("(hover: hover)").matches) {
                  scheduleClose();
                }
              }}
            >
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
                  Indikator
                </p>
                <p className="text-[9px] font-semibold tracking-wide text-slate-400">
                  grain desa
                </p>
              </div>
              <ul className="space-y-1.5">
                {sasaranKeys.map((key) => {
                  const apiKey = SASARAN_API_KEY[key];
                  const raw = indikator?.[apiKey];
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-b-0 last:pb-0"
                    >
                      <span className="text-[11px] font-semibold text-slate-500">
                        {sasaranShortLabels[key]}
                      </span>
                      <span className="text-[13px] font-extrabold tabular-nums tracking-tight text-navy">
                        {formatNullableCount(
                          raw === undefined ? null : raw,
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
