"use client";

/**
 * Judul + breadcrumb tip yang naik dari stub ID ke nama asli
 * lewat /api/peringkat (items[].nama) bila SSR belum sempat resolve.
 */

import { useMemo, type ReactNode } from "react";

import { DrilldownBreadcrumb } from "@/components/dashboard/drilldown-breadcrumb";
import { usePeringkatKabupaten } from "@/lib/hooks/use-peringkat-kabupaten";
import { usePeringkatKecamatan } from "@/lib/hooks/use-peringkat-kecamatan";
import { usePeringkatKelurahan } from "@/lib/hooks/use-peringkat-kelurahan";
import {
  isUnresolvedKabName,
  isUnresolvedKecName,
  isUnresolvedKelName,
} from "@/lib/wilayah-name-labels";

function pickNama(
  items: { id: string; nama: string }[] | undefined,
  apiId: string,
): string | null {
  const hit = items?.find(
    (item) => item.id === apiId || item.id === String(Number(apiId)),
  );
  const nama = hit?.nama?.trim();
  return nama || null;
}

export function KabupatenResolvedHeading({
  provinceName,
  provinceHref,
  initialKabName,
  provinsiApiId,
  kabupatenApiId,
  description,
  actions,
}: {
  provinceName: string;
  provinceHref: string;
  initialKabName: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  const needResolve = isUnresolvedKabName(initialKabName, kabupatenApiId);
  const peringkat = usePeringkatKabupaten(needResolve ? provinsiApiId : null);
  const kabName = useMemo(() => {
    if (!needResolve) return initialKabName;
    const fromApi = pickNama(peringkat.payload?.items, kabupatenApiId);
    if (fromApi && !isUnresolvedKabName(fromApi, kabupatenApiId)) {
      return fromApi;
    }
    return initialKabName;
  }, [needResolve, initialKabName, peringkat.payload, kabupatenApiId]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            { label: provinceName, href: provinceHref },
            { label: kabName },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="page-title !mt-0">{kabName}</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </div>
  );
}

export function KecamatanResolvedHeading({
  provinceName,
  provinceHref,
  kabHref,
  initialKabName,
  initialKecName,
  provinsiApiId,
  kabupatenApiId,
  kecamatanApiId,
  description,
  actions,
}: {
  provinceName: string;
  provinceHref: string;
  kabHref: string;
  initialKabName: string;
  initialKecName: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  kecamatanApiId: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  const needKab = isUnresolvedKabName(initialKabName, kabupatenApiId);
  const needKec = isUnresolvedKecName(initialKecName, kecamatanApiId);
  const peringkatKab = usePeringkatKabupaten(needKab ? provinsiApiId : null);
  const peringkatKec = usePeringkatKecamatan(needKec ? kabupatenApiId : null);

  const kabName = useMemo(() => {
    if (!needKab) return initialKabName;
    const fromApi = pickNama(peringkatKab.payload?.items, kabupatenApiId);
    if (fromApi && !isUnresolvedKabName(fromApi, kabupatenApiId)) {
      return fromApi;
    }
    return initialKabName;
  }, [needKab, initialKabName, peringkatKab.payload, kabupatenApiId]);

  const kecName = useMemo(() => {
    if (!needKec) return initialKecName;
    const fromApi = pickNama(peringkatKec.payload?.items, kecamatanApiId);
    if (fromApi && !isUnresolvedKecName(fromApi, kecamatanApiId)) {
      return fromApi;
    }
    return initialKecName;
  }, [needKec, initialKecName, peringkatKec.payload, kecamatanApiId]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            { label: provinceName, href: provinceHref },
            { label: kabName, href: kabHref },
            { label: kecName },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="page-title !mt-0">{kecName}</h1>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-primary uppercase">
            Kecamatan
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </div>
  );
}

export function KelurahanResolvedHeading({
  provinceName,
  provinceHref,
  kabHref,
  kecHref,
  initialKabName,
  initialKecName,
  initialKelName,
  provinsiApiId,
  kabupatenApiId,
  kecamatanApiId,
  kelurahanApiId,
  description,
  actions,
}: {
  provinceName: string;
  provinceHref: string;
  kabHref: string;
  kecHref: string;
  initialKabName: string;
  initialKecName: string;
  initialKelName: string;
  provinsiApiId: string;
  kabupatenApiId: string;
  kecamatanApiId: string;
  kelurahanApiId: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  const needKab = isUnresolvedKabName(initialKabName, kabupatenApiId);
  const needKec = isUnresolvedKecName(initialKecName, kecamatanApiId);
  const needKel = isUnresolvedKelName(initialKelName, kelurahanApiId);
  const peringkatKab = usePeringkatKabupaten(needKab ? provinsiApiId : null);
  const peringkatKec = usePeringkatKecamatan(needKec ? kabupatenApiId : null);
  const peringkatKel = usePeringkatKelurahan(needKel ? kecamatanApiId : null);

  const kabName = useMemo(() => {
    if (!needKab) return initialKabName;
    const fromApi = pickNama(peringkatKab.payload?.items, kabupatenApiId);
    if (fromApi && !isUnresolvedKabName(fromApi, kabupatenApiId)) {
      return fromApi;
    }
    return initialKabName;
  }, [needKab, initialKabName, peringkatKab.payload, kabupatenApiId]);

  const kecName = useMemo(() => {
    if (!needKec) return initialKecName;
    const fromApi = pickNama(peringkatKec.payload?.items, kecamatanApiId);
    if (fromApi && !isUnresolvedKecName(fromApi, kecamatanApiId)) {
      return fromApi;
    }
    return initialKecName;
  }, [needKec, initialKecName, peringkatKec.payload, kecamatanApiId]);

  const kelName = useMemo(() => {
    if (!needKel) return initialKelName;
    const fromApi = pickNama(peringkatKel.payload?.items, kelurahanApiId);
    if (fromApi && !isUnresolvedKelName(fromApi, kelurahanApiId)) {
      return fromApi;
    }
    return initialKelName;
  }, [needKel, initialKelName, peringkatKel.payload, kelurahanApiId]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div className="min-w-0">
        <DrilldownBreadcrumb
          items={[
            { label: "Nasional", href: "/" },
            { label: provinceName, href: provinceHref },
            { label: kabName, href: kabHref },
            { label: kecName, href: kecHref },
            { label: kelName },
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="page-title !mt-0">{kelName}</h1>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-primary uppercase">
            Desa/Kelurahan
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions}
    </div>
  );
}
