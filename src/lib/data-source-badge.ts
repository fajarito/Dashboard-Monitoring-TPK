import type { DataSource } from "@/lib/data/types";

export type SourceBadge = {
  /** Label title-case, mis. "Data live". */
  label: string;
  /** Label uppercase header, mis. "DATA LIVE". */
  labelUpper: string;
  className: string;
};

/**
 * Badge UI dari meta.source API.
 * postgres → live (emerald); mock → simulasi (amber); selain itu sembunyikan.
 */
export function resolveSourceBadge(
  source: DataSource | null | undefined,
): SourceBadge | null {
  if (source === "postgres") {
    return {
      label: "Data live",
      labelUpper: "DATA LIVE",
      className: "bg-emerald-50 text-emerald-700",
    };
  }
  if (source === "mock") {
    return {
      label: "Data simulasi",
      labelUpper: "DATA SIMULASI",
      className: "bg-amber-50 text-amber-700",
    };
  }
  return null;
}
