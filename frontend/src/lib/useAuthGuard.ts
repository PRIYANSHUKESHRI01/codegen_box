"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { Role, homeRouteForRole } from "./auth";

type GuardStatus = "loading" | "ready" | "denied";

/**
 * Applies per-page role-gating on top of the app-wide AuthContext (see
 * AuthContext.tsx). The actual session verification (GET /api/me) happens
 * once per app session in AuthProvider, not here — this hook just reads
 * that shared result and redirects if the signed-in role isn't allowed on
 * this page, which is what keeps every subsequent navigation instant.
 */
export function useAuthGuard(allowedRoles?: Role[]) {
  const { user, status: authStatus } = useAuth();
  const router = useRouter();

  const roleMismatch = authStatus === "ready" && !!user && !!allowedRoles && !allowedRoles.includes(user.role);

  useEffect(() => {
    if (authStatus === "signed_out") {
      if (typeof window !== "undefined") {
        const current = `${window.location.pathname}${window.location.search}`;
        if (
          current &&
          current !== "/" &&
          !current.startsWith("/login") &&
          !current.startsWith("/signup")
        ) {
          router.replace(`/login?redirect=${encodeURIComponent(current)}`);
          return;
        }
      }
      router.replace("/login");
      return;
    }
    if (roleMismatch && user) {
      router.replace(homeRouteForRole(user.role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, roleMismatch, user, router]);

  const status: GuardStatus =
    authStatus === "signed_out" ? "loading" : roleMismatch ? "denied" : authStatus;

  return { user: status === "ready" ? user : null, status };
}
