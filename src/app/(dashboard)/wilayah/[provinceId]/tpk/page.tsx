import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { LiveTpkListPanel } from "@/components/dashboard/live-tpk-list-panel";
import { Button } from "@/components/ui/button";
import { getKabupatenApiId } from "@/lib/kabupaten-api-id";
import { getProvinsiApiId } from "@/lib/province-api-id";
import { getProvinceOrNull } from "@/lib/tpk-drilldown-data";
import {
  getKabupatenById,
  getKecamatanById,
} from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string }>;
  searchParams: Promise<{
    kab?: string;
    kec?: string;
    kabupatenId?: string;
  }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId } = await params;
  const province = getProvinceOrNull(provinceId);
  return {
    title: province ? `Daftar TPK · ${province.name}` : "Daftar TPK",
  };
}

/** Halaman daftar TPK live (paging SIGA) — filter provinsi + kab opsional. */
export default async function WilayahTpkListPage({
  params,
  searchParams,
}: PageProps) {
  const { provinceId } = await params;
  const {
    kab: kabSlug,
    kec: kecId,
    kabupatenId: kabupatenIdParam,
  } = await searchParams;
  const province = getProvinceOrNull(provinceId);
  if (!province) notFound();

  // Redirect hierarki lama (slug kab/kec) — kec tetap ke halaman kec.
  if (kabSlug && kecId && getKecamatanById(provinceId, kabSlug, kecId)) {
    redirect(`/wilayah/${provinceId}/kab/${kabSlug}/kec/${kecId}`);
  }

  const provinsiApiId = getProvinsiApiId(province);
  if (!provinsiApiId) notFound();

  let initialKabupatenId: string | null = kabupatenIdParam?.trim() || null;
  if (!initialKabupatenId && kabSlug) {
    const fromSlug = getKabupatenApiId(kabSlug);
    if (fromSlug) {
      initialKabupatenId = fromSlug;
    } else if (getKabupatenById(provinceId, kabSlug)) {
      // Slug hierarki tanpa mapping API → halaman kab lama.
      redirect(`/wilayah/${provinceId}/kab/${kabSlug}`);
    }
  }

  const mapHref = `/?wilayah=prov-${provinceId}`;
  const provinceHref = `/wilayah/${provinceId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              { label: province.name, href: provinceHref },
              { label: "Daftar TPK" },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">Daftar TPK · {province.name}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Daftar Tim Pendamping Keluarga aktif di{" "}
            <span className="font-semibold text-navy">{province.name}</span>.
            Filter kabupaten/kota, cari nama, dan gunakan paging — data dari
            API (mock lokal atau SIGA live).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={provinceHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Ke {province.name}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={mapHref}>Ke peta</Link>
          </Button>
        </div>
      </div>

      <LiveTpkListPanel
        provinceSlug={provinceId}
        provinsiApiId={provinsiApiId}
        initialKabupatenId={initialKabupatenId}
        provinceName={province.name}
      />
    </section>
  );
}
