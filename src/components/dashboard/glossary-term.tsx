"use client";

import Link from "next/link";
import { BookOpenText, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { getGlossaryEntry, type GlossaryEntry } from "@/lib/glossary";
import { cn } from "@/lib/utils";

type GlossaryTermProps = {
  /** id entri di lib/glossary */
  termId: string;
  children?: ReactNode;
  className?: string;
};

export function GlossaryTerm({
  termId,
  children,
  className,
}: GlossaryTermProps) {
  const entry = getGlossaryEntry(termId);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, panelId]);

  if (!entry) {
    return <span className={className}>{children ?? termId}</span>;
  }

  function toggle() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 320;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - 220);
    setCoords({ top, left });
    setOpen((value) => !value);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "inline underline decoration-dotted decoration-slate-300 underline-offset-[3px] transition-colors hover:text-primary hover:decoration-primary",
          className,
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
      >
        {children ?? entry.term}
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <GlossaryPopover
              id={panelId}
              entry={entry}
              top={coords.top}
              left={coords.left}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function GlossaryPopover({
  id,
  entry,
  top,
  left,
  onClose,
}: {
  id: string;
  entry: GlossaryEntry;
  top: number;
  left: number;
  onClose: () => void;
}) {
  return (
    <div
      id={id}
      role="dialog"
      aria-label={`Penjelasan ${entry.term}`}
      className="fixed z-[60] w-80 rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]"
      style={{ top, left }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
            <BookOpenText className="size-3" aria-hidden />
            Istilah
          </div>
          <div className="mt-1 text-base font-extrabold tracking-tight text-navy">
            {entry.term}
          </div>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
            {entry.short}
          </div>
        </div>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-navy"
          aria-label="Tutup"
          onClick={onClose}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        {entry.definition}
      </p>
      <Link
        href={`/istilah#${entry.id}`}
        className="mt-4 inline-flex text-[11px] font-bold text-primary hover:underline"
        onClick={onClose}
      >
        Lihat di Keterangan Istilah →
      </Link>
    </div>
  );
}
