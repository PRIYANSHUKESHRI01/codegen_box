"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { activityTracker } from "@/lib/activityTracker";

/** A page's own tab ("/superadmin?tab=students", "/admin/placements?tab=drives"): the only part of the query string that is reported. */
const TAB_KEYS = ["tab", "section"];
const SAFE = /^[A-Za-z0-9_-]{1,30}$/;

function tabOf(params: URLSearchParams | null): string | null {
  for (const key of TAB_KEYS) {
    const value = params?.get(key);
    if (value && SAFE.test(value)) return value.toLowerCase();
  }
  return null;
}

function Reporter() {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabOf(params);

  useEffect(() => {
    activityTracker().navigate(pathname || "/", tab);
  }, [pathname, tab]);

  return null;
}

/**
 * Mounted once at the root, inside AuthProvider: while someone is signed in (and is not a superadmin) it tells the server which screen
 * they are on, for how long and how far down they scrolled, so Superadmin -> Live Activity can show it (see lib/activityTracker).
 * Starts on sign-in, stops on sign-out. Renders nothing.
 */
export function ActivityRuntime() {
  const { user, status } = useAuth();
  const track = status === "ready" && !!user && user.role !== "superadmin";
  const userId = track ? user.id : null;

  useEffect(() => {
    if (userId === null) return;
    const tracker = activityTracker();
    tracker.start();
    return () => tracker.stop();
  }, [userId]);

  return track ? (
    <Suspense fallback={null}>
      <Reporter />
    </Suspense>
  ) : null;
}
