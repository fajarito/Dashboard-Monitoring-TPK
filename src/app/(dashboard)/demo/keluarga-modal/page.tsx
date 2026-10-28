"use client";

import { KeluargaDetailModal } from "@/components/dashboard/keluarga-detail-modal";

/** Halaman smoke screenshot — modal detail by KKI dari sample stunting_head. */
export default function DemoKeluargaModalPage() {
  return (
    <div className="min-h-[70vh] bg-slate-100 p-6">
      <p className="text-sm text-slate-600">
        Demo modal detail keluarga — lookup by KKI → stunting_head.
      </p>
      <KeluargaDetailModal
        open
        kki={"11061020310200      001019026"}
        provinsiId={1}
        fallbackNama="vXCp9Du"
        onClose={() => undefined}
      />
    </div>
  );
}
