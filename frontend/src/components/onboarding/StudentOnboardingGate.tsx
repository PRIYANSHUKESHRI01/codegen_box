"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { StudentOnboardingModal } from "./StudentOnboardingModal";

/**
 * How long to wait after the page appears before asking. The signed-in user is
 * first read from this device's cache and re-checked against the server a moment
 * later (see AuthProvider) — waiting for that check means a student who already
 * answered on another device never sees the wizard flash up and vanish.
 */
const SETTLE_MS = 900;

/**
 * Shows the first-login onboarding to a student the server says still owes it
 * (`onboarding_pending` — never completed, and not skipped within the cool-off).
 * Mounted once, by the dashboard shell, so it appears on whichever student page
 * they land on; never on a proctored exam screen (that shell has no chrome).
 *
 * Skipping is remembered on the server so it isn't asked again on every page,
 * and locally for the rest of this visit so a failed network call can't trap
 * the student behind a dialog they chose to dismiss.
 */
export function StudentOnboardingGate() {
  const { user, status, login } = useAuth();
  const [settled, setSettled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status !== "ready" || !user || user.role !== "user" || !user.onboarding_pending || !settled || dismissed) {
    return null;
  }

  const skip = async () => {
    setDismissed(true);
    try {
      const res = await api.post<{ user: AuthUser }>("/me/onboarding/skip");
      const token = getToken();
      if (token) login(token, res.user);
    } catch {
      // Remembered for this visit regardless; the server will simply ask again next time.
    }
  };

  return <StudentOnboardingModal onDone={() => setDismissed(true)} onSkip={skip} />;
}
