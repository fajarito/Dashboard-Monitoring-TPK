import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { SasaranIndikatorPanel } from "@/components/dashboard/sasaran-indikator-panel";
import { TpkKeluargaTable } from "@/components/dashboard/tpk-keluarga-table";
import { TpkMemberCards } from "@/components/dashboard/tpk-member-cards";
import { TpkPrioritasDonut } from "@/components/dashboard/tpk-prioritas-donut";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/map-data";
import {
  getProvinceOrNull,
  getTpkById,
  getTpkPrioritasKomposisi,
} from "@/lib/tpk-drilldown-data";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ provinceId: string; tpkId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { provinceId, tpkId } = await params;
  const tpk = getTpkById(provinceId, tpkId);
  return {
    title: tpk ? `${tpk.name} · Detail TPK` : "Detail TPK",
  };
}

export default async function TpkDetailPage({ params }: PageProps) {
  const { provinceId, tpkId } = await params;
  const province = getProvinceOrNull(provinceId);
  const tpk = getTpkById(provinceId, tpkId);
  if (!province || !tpk) notFound();

  const listHref = `/wilayah/${provinceId}/tpk`;
  const mapHref = `/?wilayah=prov-${provinceId}`;
  const prioritas = getTpkPrioritasKomposisi(tpk);

  return (
    <section className="animate-content-enter space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <DrilldownBreadcrumb
            items={[
              { label: "Nasional", href: "/" },
              { label: province.name, href: `/wilayah/${provinceId}` },
              { label: "Daftar TPK", href: listHref },
              { label: tpk.name },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="page-title !mt-0">{tpk.name}</h1>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-amber-700 uppercase">
              Data simulasi
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase",
                tpk.status === "Aktif"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              {tpk.status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {tpk.code} · Desa/Kel. {tpk.desa}, Kec. {tpk.kecamatan},{" "}
            {tpk.kabupaten}, {province.name} ·{" "}
            <span className="font-semibold text-navy">
              {formatNumber(tpk.keluargaSasaran)} keluarga sasaran
            </span>
            {" · "}
            <span className="font-semibold text-navy">
              {formatNumber(tpk.krs)} KRS
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 rounded-xl border-line bg-white"
          >
            <Link href={listHref}>
              <ArrowLeft className="size-4" aria-hidden />
              Daftar TPK
            </Link>
          </Button>
        </div>
      </div>

      <TpkMemberCards members={tpk.members} />

      <SasaranIndikatorPanel
        scopeLabel={tpk.name}
        counts={tpk.sasaran}
        keluargaSasaran={tpk.keluargaSasaran}
        krs={tpk.krs}
      />

      <TpkPrioritasDonut
        tpkName={tpk.name}
        total={prioritas.total}
        slices={prioritas.slices}
      />

      <TpkKeluargaTable keluarga={tpk.keluarga} tpkName={tpk.name} />

      <p className="text-[11px] text-slate-400">
        Jejak:{" "}
        <Link href="/" className="font-semibold text-primary hover:underline">
          Peta
        </Link>{" "}
        →{" "}
        <Link
          href={mapHref}
          className="font-semibold text-primary hover:underline"
        >
          {province.name}
        </Link>{" "}
        →{" "}
        <Link
          href={listHref}
          className="font-semibold text-primary hover:underline"
        >
          Daftar TPK
        </Link>{" "}
        → {tpk.name} → Keluarga binaan
      </p>
    </section>
  );
}
