import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

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
import { getKabupatenById, getKecamatanById } from "@/lib/wilayah-hierarchy-data";

type PageProps = {
  params: Promise<{ provinceId: string; kabId: string; kecId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, kabId, kecId } = await params;
  const kec = getKecamatanById(provinceId, kabId, kecId);
  return {
    title: kec ? `Kecamatan ${kec.name}` : "Kecamatan",
  };
}

export default async function KecamatanTpkPage({ params }: PageProps) {
  const { provinceId, kabId, kecId } = await params;
  const province = getProvinceOrNull(provinceId);
  const kab = getKabupatenById(provinceId, kabId);
  const kec = getKecamatanById(provinceId, kabId, kecId);
  if (!province || !kab || !kec) notFound();

  const tpkList = getTpkForScope({
    provinceId,
    kabupatenId: kab.id,
    kecamatanId: kec.id,
  });
  const summary = summarizeTpkList(tpkList);
  const kabHref = `/wilayah/${provinceId}/kab/${kabId}`;

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              { label: province.name, href: `/wilayah/${provinceId}` },
              { label: kab.name, href: kabHref },
              { label: kec.name },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">{kec.name}</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-primary uppercase">
              Kecamatan
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Kecamatan aktif di {kab.name}: daftar TPK di wilayah ini dengan
            filter nama dan paging.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 gap-2 rounded-xl border-line bg-white"
        >
          <Link href={kabHref}>
            <ArrowLeft className="size-4" aria-hidden />
            Kembali ke {kab.name}
          </Link>
        </Button>
      </div>

      <WilayahIdentityCards
        levelLabel="Kecamatan"
        wilayahName={kec.name}
        wilayahHint={`${kab.name} · ${province.name}`}
        childCountLabel="TPK di kecamatan"
        childCount={tpkList.length}
        childCountHint="Sampel simulasi di level ini"
        krs={summary.krs}
      />

      <SasaranIndikatorPanel
        scopeLabel={kec.name}
        counts={summary.sasaran}
        keluargaSasaran={summary.keluargaSasaran}
        krs={summary.krs}
      />

      <TpkListTable
        list={tpkList}
        provinceId={provinceId}
        scopeName={kec.name}
      />
    </section>
  );
}
