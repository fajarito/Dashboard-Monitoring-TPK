import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Health/readiness ringan — TIDAK query SIGA/WILAYAH/DWH.
 * Jangan pakai /api/ringkasan sebagai probe: probe 10s menekan DWH + bisa
 * menggagalkan pod saat query lambat (lihat UAT Jatim).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "dashboard-monitoring-tpk",
      ts: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
