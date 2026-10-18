import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";

import { glossaryEntries } from "@/lib/glossary";
import { navItems } from "@/lib/navigation";

const page = navItems.find((item) => item.href === "/istilah")!;

export const metadata: Metadata = {
  title: page.title,
};

export default function IstilahPage() {
  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Glosarium hidup</div>
          <h1 className="page-title">Keterangan Istilah</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Penjelasan singkat istilah yang muncul di dashboard — bahasa
            sehari-hari, selaras dengan popover di kartu dan tabel.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-primary">
          <BookOpenText className="size-3.5" aria-hidden />
          {glossaryEntries.length} istilah
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {glossaryEntries.map((entry) => (
          <article
            key={entry.id}
            id={entry.id}
            className="design-card scroll-mt-28 p-6 sm:p-7"
          >
            <div className="text-[10px] font-extrabold tracking-[0.14em] text-primary uppercase">
              Istilah
            </div>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-navy">
              {entry.term}
            </h2>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-400">
              {entry.short}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              {entry.definition}
            </p>
            {entry.aliases && entry.aliases.length > 0 ? (
              <p className="mt-3 text-[11px] text-slate-400">
                Juga disebut: {entry.aliases.join(" · ")}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <p className="text-[12px] text-muted-foreground">
        Tip: di halaman peta atau detail TPK, klik istilah bergaris putus-putus
        untuk membuka penjelasan singkat, lalu{" "}
        <Link href="/istilah" className="font-bold text-primary hover:underline">
          kembali ke glosarium lengkap
        </Link>
        .
      </p>
    </section>
  );
}
