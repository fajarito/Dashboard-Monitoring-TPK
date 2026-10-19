import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { LiveKabupatenWilayahPanel } from "@/components/dashboard/live-kabupaten-wilayah-panel";
import { Button } from "@/components/ui/button";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import { getKabupatenById } from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string; kabId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, kabId } = await params;
  const kab = getKabupatenById(provinceId, kabId);
  return {
    title: kab ? kab.name : "Kabupaten/Kota",
  };
}

export default async function KabupatenKecamatanPage({ params }: PageProps) {
  const { provinceId, kabId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  if (!province || !kab) notFound();

  const provinsiApiId = getProvinsiApiId(province);
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  if (!provinsiApiId || !kabupatenApiId) notFound();

  const provinceHref = `/wilayah/${provinceId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              { label: province.name, href: provinceHref },
              { label: kab.name },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">{kab.name}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Kabupaten/kota aktif di {province.name}: ringkasan, daftar
            kecamatan, dan daftar TPK. Angka mengikuti API ringkasan &amp;
            peringkat.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 gap-2 rounded-xl border-line bg-white"
        >
          <Link href={provinceHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke {province.name}
          </Link>
        </Button>
      </div>

      <LiveKabupatenWilayahPanel
        provinceSlug={provinceId}
        kabSlug={kabId}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kabName={kab.name}
        provinceName={province.name}
      />
    </section>
  );
}
