import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { KabupatenResolvedHeading } from "@/components/dashboard/wilayah-resolved-heading";
import { LiveKabupatenWilayahPanel } from "@/components/dashboard/live-kabupaten-wilayah-panel";
import { Button } from "@/components/ui/button";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import { resolveKabupatenDisplayName } from "@/lib/wilayah-display-name";
import { getKabupatenById } from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string; kabId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, kabId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  if (!province || !kab) {
    return { title: "Kabupaten/Kota" };
  }
  const provinsiApiId = getProvinsiApiId(province);
  if (!provinsiApiId) {
    return { title: kab.name };
  }
  const nama = await resolveKabupatenDisplayName({
    provinceId,
    kabId,
    provinsiApiId,
  });
  return { title: nama };
}

export default async function KabupatenKecamatanPage({ params }: PageProps) {
  const { provinceId, kabId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  if (!province || !kab) notFound();

  const provinsiApiId = getProvinsiApiId(province);
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  if (!provinsiApiId || !kabupatenApiId) notFound();

  const kabName = await resolveKabupatenDisplayName({
    provinceId,
    kabId,
    provinsiApiId,
  });

  const provinceHref = `/wilayah/${provinceId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <KabupatenResolvedHeading
        provinceName={province.name}
        provinceHref={provinceHref}
        initialKabName={kabName}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        description={
          <>
            Kabupaten/kota aktif di {province.name}: ringkasan, daftar
            kecamatan, dan daftar TPK. Angka mengikuti API ringkasan &amp;
            peringkat.
          </>
        }
        actions={
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
        }
      />

      <LiveKabupatenWilayahPanel
        provinceSlug={provinceId}
        kabSlug={kabId}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kabName={kabName}
        provinceName={province.name}
      />
    </section>
  );
}
