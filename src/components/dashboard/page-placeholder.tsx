import type { LucideIcon } from "lucide-react";

type PagePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  note: string;
};

export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  note,
}: PagePlaceholderProps) {
  return (
    <section className="animate-content-enter mx-auto w-full max-w-4xl">
      <div className="eyebrow">Kerangka halaman</div>
      <h1 className="page-title">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {description}
      </p>

      <div className="design-card relative mt-5 overflow-hidden px-6 py-10 sm:px-10">
        <div
          className="pointer-events-none absolute -top-24 right-0 size-56 rounded-full bg-blue-100/70 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6">
          <div className="grid size-12 place-items-center rounded-xl bg-blue-100 text-primary shadow-sm">
            <Icon className="size-6" aria-hidden />
          </div>
          <div className="max-w-2xl border-l-2 border-primary/30 pl-4">
            <p className="text-sm leading-relaxed text-ink/80">{note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
