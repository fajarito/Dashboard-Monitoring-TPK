import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { KecamatanResolvedHeading } from "@/components/dashboard/wilayah-resolved-heading";
import { LiveKecamatanWilayahPanel } from "@/components/dashboard/live-kecamatan-wilayah-panel";
import { Button } from "@/components/ui/button";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getKecamatanApiId } from "@/lib/kecamatan-api-id";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import {
  resolveKabupatenDisplayName,
  resolveKecamatanDisplayName,
} from "@/lib/wilayah-display-name";
import { getKabupatenById, getKecamatanById } from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string; kabId: string; kecId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, kabId, kecId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  const kec = getKecamatanById(provinceId, kabId, kecId);
  if (!province || !kab || !kec) {
    return { title: "Kecamatan" };
  }
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  if (!kabupatenApiId) {
    return { title: kec.name };
  }
  const nama = await resolveKecamatanDisplayName({
    provinceId,
    kabId,
    kecId,
    kabupatenApiId,
  });
  return { title: nama };
}

export default async function KecamatanTpkPage({ params }: PageProps) {
  const { provinceId, kabId, kecId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  const kec = getKecamatanById(provinceId, kabId, kecId);
  if (!province || !kab || !kec) notFound();

  const provinsiApiId = getProvinsiApiId(province);
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  const kecamatanApiId = getKecamatanApiId(kec.id) ?? getKecamatanApiId(kecId);
  if (!provinsiApiId || !kabupatenApiId || !kecamatanApiId) notFound();

  const [kabName, kecName] = await Promise.all([
    resolveKabupatenDisplayName({
      provinceId,
      kabId,
      provinsiApiId,
    }),
    resolveKecamatanDisplayName({
      provinceId,
      kabId,
      kecId,
      kabupatenApiId,
    }),
  ]);

  const kabHref = `/wilayah/${provinceId}/kab/${kabId}`;
  const provinceHref = `/wilayah/${provinceId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <KecamatanResolvedHeading
        provinceName={province.name}
        provinceHref={provinceHref}
        kabHref={kabHref}
        initialKabName={kabName}
        initialKecName={kecName}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kecamatanApiId={kecamatanApiId}
        description={
          <>
            Kecamatan aktif di {kabName}: ringkasan, daftar desa/kelurahan, dan
            daftar TPK. Angka mengikuti API ringkasan &amp; peringkat.
          </>
        }
        actions={
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={kabHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Kembali ke {kabName}
            </Link>
          </Button>
        }
      />

      <LiveKecamatanWilayahPanel
        provinceSlug={provinceId}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kecamatanApiId={kecamatanApiId}
        kecName={kecName}
        kabName={kabName}
        provinceName={province.name}
      />
    </section>
  );
}
