import { LiveTpkDetailPanel } from "@/components/dashboard/live-tpk-detail-panel";

type PageProps = {
  params: Promise<{ provinceId: string; tpkId: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { tpkId } = await params;
  const id = decodeURIComponent(tpkId);
  return {
    title: id ? `Detail TPK · ${id}` : "Detail TPK",
  };
}

export default async function TpkDetailPage({ params }: PageProps) {
  const { provinceId, tpkId } = await params;
  return (
    <LiveTpkDetailPanel
      provinceSlug={provinceId}
      tpkId={decodeURIComponent(tpkId)}
    />
  );
}
