"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders `fallback` on the server and during the first client paint so
 * hydration HTML matches. Swaps to `children` only after mount (useEffect).
 *
 * Needed when a child is `next/dynamic(..., { ssr: false })` whose chunk is
 * preloaded: without this gate the client can skip the dynamic `loading`
 * fallback during hydrate and diverge from the server MapSkeleton.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
