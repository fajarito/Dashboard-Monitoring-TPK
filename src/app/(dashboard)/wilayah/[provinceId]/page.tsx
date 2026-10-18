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
  summarizeTpkList,
} from "@/lib/tpk-drilldown-data";
import {
  getKabupatenByProvince,
  summarizeChildRows,
} from "@/lib/wilayah-hierarchy-data";

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

  const kabList = getKabupatenByProvince(provinceId);
  const kabSummary = summarizeChildRows(kabList);
  const tpkList = getTpkForScope({ provinceId });
  const tpkSummary = summarizeTpkList(tpkList);
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
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Provinsi aktif: daftar kabupaten/kota dan daftar TPK di wilayah ini.
            Gunakan filter & paging pada setiap tabel.
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

      <WilayahIdentityCards
        levelLabel="Provinsi"
        wilayahName={province.name}
        wilayahHint="Wilayah yang sedang dipilih"
        childCountLabel="Kabupaten/Kota"
        childCount={kabList.length}
        childCountHint="Ditampilkan di tabel wilayah anak"
        krs={kabSummary.krs}
      />

      <SasaranIndikatorPanel
        scopeLabel={province.name}
        counts={kabSummary.sasaran}
        keluargaSasaran={kabSummary.keluargaSasaran}
        krs={kabSummary.krs}
      />

      <WilayahChildTable
        rows={kabList.map((row) => ({
          ...row,
          href: `/wilayah/${provinceId}/kab/${row.id}`,
        }))}
        scopeLabel={province.name}
        childLabel="Kabupaten/Kota"
        actionLabel="Kecamatan"
      />

      <TpkListTable
        list={tpkList}
        provinceId={provinceId}
        scopeName={province.name}
        scopeFilterMode="kabupaten"
        scopeFilters={kabList.map((kab) => ({
          id: kab.id,
          label: kab.name.replace(/^(Kota|Kabupaten)\s+/i, ""),
        }))}
      />

      <p className="text-[11px] text-muted-foreground">
        Cuplikan TPK di level ini: {tpkSummary.keluargaSasaran.toLocaleString("id-ID")}{" "}
        keluarga sasaran dari {tpkList.length} tim (simulasi).
      </p>
    </section>
  );
}
