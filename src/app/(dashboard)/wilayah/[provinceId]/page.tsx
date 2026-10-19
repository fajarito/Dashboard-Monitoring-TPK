import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { LiveProvinceWilayahPanel } from "@/components/dashboard/live-province-wilayah-panel";
import { Button } from "@/components/ui/button";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";

type PageProps = {
  params: Promise<{ provinceId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId } = await params;
  const province = getProvinceOrNull(provinceId);
  return {
    title: province ? province.name : "Wilayah",
  };
}

export default async function ProvinceKabupatenPage({ params }: PageProps) {
  const { provinceId } = await params;
  const province = getProvinceOrNull(provinceId);
  if (!province) notFound();

  const provinsiApiId = getProvinsiApiId(province);
  if (!provinsiApiId) notFound();

  const mapHref = `/?wilayah=prov-${provinceId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              { label: province.name },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">{province.name}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Provinsi aktif: ringkasan, daftar kabupaten/kota, dan daftar TPK di
            wilayah ini. Angka mengikuti API ringkasan &amp; peringkat.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 gap-2 rounded-xl border-line bg-white"
        >
          <Link href={mapHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke peta
          </Link>
        </Button>
      </div>

      <LiveProvinceWilayahPanel
        provinceSlug={provinceId}
        provinsiApiId={provinsiApiId}
        provinceName={province.name}
      />
    </section>
  );
}
