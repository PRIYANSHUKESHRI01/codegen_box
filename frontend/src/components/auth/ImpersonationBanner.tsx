"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { IMPERSONATION_CHANGED_EVENT, endImpersonation, getImpersonation, type ImpersonationState } from "@/lib/impersonation";

const ROLE_LABEL: Record<string, string> = {
  user: "Student",
  admin_tpo: "College TPO",
  section_coordinator: "Section Coordinator",
  admin_company: "Hiring partner",
  admin_internal: "Mellow staff (Ops)",
  admin_marketing: "Mellow staff (Marketing)",
};

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Shown on every page, for as long as a superadmin is looking at the product as
 * someone else ("view as" — see lib/impersonation). It cannot be missed and cannot
 * be mistaken for the real thing: it names who is being viewed, says the session is
 * read-only, counts down to the token's expiry, and is the one way back.
 *
 * Fixed to the bottom-centre rather than the top so it never shifts a layout that
 * every dashboard page already carefully budgets (a fixed rail and a sticky bar).
 */
export function ImpersonationBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const sync = () => setState(getImpersonation());
    sync();
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, sync);
    // Another tab of this browser started or ended a view.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(IMPERSONATION_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state]);

  // Only while the browser really is signed in as the viewed account.
  if (!state || !user || user.id !== state.target.id) return null;

  const remaining = new Date(state.expiresAt).getTime() - now;
  const expired = remaining <= 0;

  const exit = async () => {
    setLeaving(true);
    await endImpersonation();
    // A full navigation, not a client-side one: every cached bit of the viewed account's session
    // (plan state, open pages' data) must be gone, not just hidden behind the superadmin's.
    window.location.assign("/superadmin?tab=accounts");
  };

  return (
    <div role="region" aria-label="Viewing as another account" className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-amber-500/50 bg-[#1b1405] py-2 pl-4 pr-2 text-amber-100 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)]">
        <Eye className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p className="min-w-0 text-xs leading-tight">
          <span className="font-bold">Viewing as {state.target.name}</span>
          <span className="text-amber-200/80"> · {ROLE_LABEL[state.target.role] ?? state.target.role} · read-only</span>
          <span className="ml-2 font-mono text-amber-300/90" aria-live="off">
            {expired ? "expired" : formatRemaining(remaining)}
          </span>
        </p>
        <button
          type="button"
          onClick={() => void exit()}
          disabled={leaving}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-amber-950 transition-colors hover:bg-amber-300 disabled:opacity-70"
        >
          {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Exit view
        </button>
      </div>
    </div>
  );
}
