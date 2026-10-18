import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { TpkListTable } from "@/components/dashboard/tpk-list-table";
import { WilayahIdentityCards } from "@/components/dashboard/wilayah-meta-cards";
import { Button } from "@/components/ui/button";
import {
  getProvinceOrNull,
  getTpkForScope,
  summarizeTpkList,
} from "@/lib/tpk-drilldown-data";
import {
  getKabupatenById,
  getKabupatenByProvince,
  getKecamatanById,
} from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string }>;
  searchParams: Promise<{ kab?: string; kec?: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId } = await params;
  const province = getProvinceOrNull(provinceId);
  return {
    title: province ? `Daftar TPK · ${province.name}` : "Daftar TPK",
  };
}

/** Halaman TPK khusus — redirect ke hierarki bila ada kab/kec di query. */
export default async function WilayahTpkListPage({
  params,
  searchParams,
}: PageProps) {
  const { provinceId } = await params;
  const { kab: kabId, kec: kecId } = await searchParams;
  const province = getProvinceOrNull(provinceId);
  if (!province) notFound();

  if (kabId && kecId && getKecamatanById(provinceId, kabId, kecId)) {
    redirect(`/wilayah/${provinceId}/kab/${kabId}/kec/${kecId}`);
  }
  if (kabId && getKabupatenById(provinceId, kabId)) {
    redirect(`/wilayah/${provinceId}/kab/${kabId}`);
  }

  const list = getTpkForScope({ provinceId });
  const summary = summarizeTpkList(list);
  const kabList = getKabupatenByProvince(provinceId);
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
            <h1 className="page-title !mt-0">{province.name}</h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Daftar TPK di{" "}
            <span className="font-semibold text-navy">{province.name}</span> —
            sama dengan yang tampil di halaman provinsi; gunakan filter
            kabupaten/kota dan paging.
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

      <WilayahIdentityCards
        levelLabel="Provinsi"
        wilayahName={province.name}
        wilayahHint="Wilayah yang sedang dipilih"
        childCountLabel="TPK ditampilkan"
        childCount={list.length}
        childCountHint="Sampel simulasi di wilayah ini"
        krs={summary.krs}
      />

      <SasaranIndikatorPanel
        scopeLabel={province.name}
        counts={summary.sasaran}
        keluargaSasaran={summary.keluargaSasaran}
        krs={summary.krs}
      />

      <TpkListTable
        list={list}
        provinceId={provinceId}
        scopeName={province.name}
        scopeFilterMode="kabupaten"
        scopeFilters={kabList.map((kab) => ({
          id: kab.id,
          label: kab.name.replace(/^(Kota|Kabupaten)\s+/i, ""),
        }))}
      />
    </section>
  );
}
