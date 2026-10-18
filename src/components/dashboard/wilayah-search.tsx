"use client";

import { LoaderCircle, MapPinned, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import { Input } from "@/components/ui/input";
import {
  searchWilayah,
  wilayahLevelLabels,
  type WilayahSearchItem,
} from "@/lib/wilayah-search-data";
import { cn } from "@/lib/utils";

type WilayahSearchProps = {
  compact?: boolean;
  className?: string;
};

export function WilayahSearch({ compact = false, className }: WilayahSearchProps) {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<WilayahSearchItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    startTransition(() => {
      const next = searchWilayah(debounced);
      setResults(next);
      setActiveIndex(0);
      setOpen(debounced.length >= 2);
    });
  }, [debounced]);

  const close = useEffectEvent(() => {
    setOpen(false);
    setActiveIndex(0);
  });

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectItem = (item: WilayahSearchItem) => {
    setQuery(item.name);
    close();
    router.push(`/?wilayah=${encodeURIComponent(item.id)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      inputRef.current?.blur();
      return;
    }

    if (!open || results.length === 0) {
      if (event.key === "ArrowDown" && query.trim().length >= 2) {
        setOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) selectItem(item);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400",
          compact && "left-3 size-3.5",
        )}
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          if (event.target.value.trim().length >= 2) setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0 || query.trim().length >= 2) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={
          compact
            ? "Cari wilayah..."
            : "Cari seluruh tingkatan wilayah..."
        }
        className={cn(
          "rounded-xl border-line bg-white shadow-none focus-visible:border-[#80aaff] focus-visible:ring-[#e7efff]",
          compact ? "h-10 pl-9 pr-9" : "h-11 pl-10 pr-10",
        )}
        aria-label="Cari wilayah cepat"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={
          open && results[activeIndex]
            ? `${listboxId}-option-${results[activeIndex].id}`
            : undefined
        }
        role="combobox"
        autoComplete="off"
      />
      {query ? (
        <button
          type="button"
          className="absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-navy"
          aria-label="Hapus pencarian"
          onClick={() => {
            setQuery("");
            setResults([]);
            close();
            inputRef.current?.focus();
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : pending && debounced ? (
        <LoaderCircle
          className="absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 animate-spin text-slate-400"
          aria-hidden
        />
      ) : null}

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Hasil pencarian wilayah"
          className="absolute top-[calc(100%+0.4rem)] left-0 z-50 w-[min(100vw-2rem,26rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)]"
        >
          {results.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <div className="text-sm font-extrabold text-navy">
                {debounced.length < 2
                  ? "Mulai ketik nama wilayah"
                  : "Tidak ada hasil"}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {debounced.length < 2
                  ? "Ketik minimal 2 huruf untuk mencari provinsi, kabupaten, kecamatan, atau desa."
                  : `Tidak ada wilayah yang cocok dengan “${debounced}”. Coba ejaan lain atau nama yang lebih pendek.`}
              </p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto py-1.5">
              {results.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-option-${item.id}`}
                      role="option"
                      aria-selected={active}
                      className={cn(
                        "flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors",
                        active ? "bg-blue-50" : "hover:bg-slate-50",
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectItem(item)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                          active
                            ? "bg-primary text-white"
                            : "bg-blue-50 text-primary",
                        )}
                      >
                        <MapPinned className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-extrabold text-navy">
                            {item.name}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-500 uppercase">
                            {wilayahLevelLabels[item.level]}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {item.parentContext}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-line bg-slate-50/80 px-3.5 py-2 text-[10px] text-slate-400">
            ↑↓ pilih · Enter buka · Esc tutup · data simulasi
          </div>
        </div>
      ) : null}
    </div>
  );
}
