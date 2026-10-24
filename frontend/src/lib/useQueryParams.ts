"use client";

import { useEffect, useState } from "react";

/**
 * The page's query string, read from the address bar once mounted. Used by statically-exported pages that
 * take `?id=…` / `?mode=…` instead of dynamic route segments. Deliberately not next/navigation's
 * useSearchParams(), which forces a Suspense boundary around the whole page; `ready` is false until the first
 * client render so a page can wait for it rather than act on an empty string.
 */
export function useQueryParams(): { params: URLSearchParams; ready: boolean } {
  const [state, setState] = useState<{ params: URLSearchParams; ready: boolean }>({ params: new URLSearchParams(), ready: false });

  useEffect(() => {
    setState({ params: new URLSearchParams(window.location.search), ready: true });
  }, []);

  return state;
}
