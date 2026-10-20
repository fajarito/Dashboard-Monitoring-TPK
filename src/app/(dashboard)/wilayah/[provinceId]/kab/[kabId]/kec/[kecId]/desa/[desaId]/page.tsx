import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { LiveKelurahanWilayahPanel } from "@/components/dashboard/live-kelurahan-wilayah-panel";
import { KelurahanResolvedHeading } from "@/components/dashboard/wilayah-resolved-heading";
import { Button } from "@/components/ui/button";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getKecamatanApiId } from "@/lib/kecamatan-api-id";
import { getKelurahanApiId } from "@/lib/kelurahan-api-id";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import {
  resolveKabupatenDisplayName,
  resolveKecamatanDisplayName,
  resolveKelurahanDisplayName,
} from "@/lib/wilayah-display-name";
import { getKabupatenById, getKecamatanById } from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{
    provinceId: string;
    kabId: string;
    kecId: string;
    desaId: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, kabId, kecId, desaId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  const kec = getKecamatanById(provinceId, kabId, kecId);
  const kelurahanApiId = getKelurahanApiId(desaId);
  if (!province || !kab || !kec || !kelurahanApiId) {
    return { title: "Desa/Kelurahan" };
  }
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  const kecamatanApiId = getKecamatanApiId(kec.id) ?? getKecamatanApiId(kecId);
  if (!kabupatenApiId || !kecamatanApiId) {
    return { title: "Desa/Kelurahan" };
  }
  const nama = await resolveKelurahanDisplayName({
    desaId,
    kecamatanApiId,
  });
  return { title: nama };
}

export default async function DesaKelurahanWilayahPage({ params }: PageProps) {
  const { provinceId, kabId, kecId, desaId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  const kec = getKecamatanById(provinceId, kabId, kecId);
  const kelurahanApiId = getKelurahanApiId(desaId);
  if (!province || !kab || !kec || !kelurahanApiId) notFound();

  const provinsiApiId = getProvinsiApiId(province);
  const kabupatenApiId = getKabupatenApiId(kab.id) ?? getKabupatenApiId(kabId);
  const kecamatanApiId = getKecamatanApiId(kec.id) ?? getKecamatanApiId(kecId);
  if (!provinsiApiId || !kabupatenApiId || !kecamatanApiId) notFound();

  const [kabName, kecName, kelName] = await Promise.all([
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
    resolveKelurahanDisplayName({
      desaId,
      kecamatanApiId,
    }),
  ]);

  const provinceHref = `/wilayah/${provinceId}`;
  const kabHref = `/wilayah/${provinceId}/kab/${kabId}`;
  const kecHref = `/wilayah/${provinceId}/kab/${kabId}/kec/${kecId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <KelurahanResolvedHeading
        provinceName={province.name}
        provinceHref={provinceHref}
        kabHref={kabHref}
        kecHref={kecHref}
        initialKabName={kabName}
        initialKecName={kecName}
        initialKelName={kelName}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kecamatanApiId={kecamatanApiId}
        kelurahanApiId={kelurahanApiId}
        description={
          <>
            Desa/kelurahan aktif di {kecName}: ringkasan dan daftar TPK dalam
            lingkup kelurahan ini. Angka mengikuti API ringkasan &amp; daftar
            TPK.
          </>
        }
        actions={
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={kecHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Kembali ke {kecName}
            </Link>
          </Button>
        }
      />

      <LiveKelurahanWilayahPanel
        provinceSlug={provinceId}
        provinsiApiId={provinsiApiId}
        kabupatenApiId={kabupatenApiId}
        kecamatanApiId={kecamatanApiId}
        kelurahanApiId={kelurahanApiId}
        kelName={kelName}
        kecName={kecName}
        kabName={kabName}
        provinceName={province.name}
      />
    </section>
  );
}
