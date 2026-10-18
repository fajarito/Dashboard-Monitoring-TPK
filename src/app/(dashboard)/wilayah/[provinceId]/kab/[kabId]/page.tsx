import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { TpkListTable } from "@/components/dashboard/tpk-list-table";
import { WilayahChildTable } from "@/components/dashboard/wilayah-child-table";
import { WilayahIdentityCards } from "@/components/dashboard/wilayah-meta-cards";
import { Button } from "@/components/ui/button";
import {
  getProvinceOrNull,
  getTpkForScope,
} from "@/lib/tpk-drilldown-data";
import {
  getKabupatenById,
  summarizeChildRows,
} from "@/lib/wilayah-hierarchy-data";

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

  const kecList = kab.kecamatan;
  const summary = summarizeChildRows(kecList);
  const tpkList = getTpkForScope({ provinceId, kabupatenId: kab.id });
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
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Kabupaten/kota aktif di {province.name}: daftar kecamatan dan daftar
            TPK di wilayah ini.
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

      <WilayahIdentityCards
        levelLabel="Kabupaten/Kota"
        wilayahName={kab.name}
        wilayahHint={province.name}
        childCountLabel="Kecamatan"
        childCount={kecList.length}
        childCountHint="Ditampilkan di tabel wilayah anak"
        krs={summary.krs}
      />

      <SasaranIndikatorPanel
        scopeLabel={kab.name}
        counts={summary.sasaran}
        keluargaSasaran={summary.keluargaSasaran}
        krs={summary.krs}
      />

      <WilayahChildTable
        rows={kecList.map((row) => ({
          ...row,
          href: `/wilayah/${provinceId}/kab/${kabId}/kec/${row.id}`,
        }))}
        scopeLabel={kab.name}
        childLabel="Kecamatan"
        actionLabel="Buka"
      />

      <TpkListTable
        list={tpkList}
        provinceId={provinceId}
        scopeName={kab.name}
        scopeFilterMode="kecamatan"
        scopeFilters={kecList.map((kec) => ({
          id: kec.id,
          label: kec.name,
        }))}
      />
    </section>
  );
}
