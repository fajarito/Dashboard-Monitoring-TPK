import { Suspense } from "react";

import { MapSebaran } from "@/components/dashboard/map-sebaran";

export default function PetaSebaranPage() {
  return (
    <Suspense
      fallback={
        <div className="design-card grid min-h-[320px] place-items-center text-sm text-muted-foreground">
          Menyiapkan peta sebaran…
        </div>
      }
    >
      <MapSebaran />
    </Suspense>
  );
}
