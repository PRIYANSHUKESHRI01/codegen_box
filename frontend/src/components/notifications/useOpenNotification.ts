"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { markRead, safeInternalPath, type AppNotification } from "@/lib/notifications";

/**
 * What clicking a notification does: mark it read, then go where it points. The link is the server's, but it is checked
 * again here — only an in-app path is ever followed, so a notification can never send someone off-site or run a script.
 */
export function useOpenNotification(after?: () => void) {
  const router = useRouter();

  return useCallback(
    (n: AppNotification) => {
      void markRead(n.id);
      after?.();

      const path = safeInternalPath(n.url);
      if (path) router.push(path);
    },
    [router, after]
  );
}
