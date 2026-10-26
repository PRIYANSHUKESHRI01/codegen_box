"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { ManagedUserResponse } from "@/types/adminSubscriptions";
import { roleInfo } from "./accountRoles";
import { ActivitySection } from "./manage/ActivitySection";
import { OverviewSection, type StudentDetail } from "./manage/OverviewSection";
import { PlanSection } from "./manage/PlanSection";
import { SecuritySection } from "./manage/SecuritySection";
import { type ToastTrigger } from "@/lib/toast";

type Tab = "overview" | "plan" | "security" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan & billing" },
  { id: "security", label: "Sign-in & access" },
  { id: "activity", label: "Activity" },
];

interface UserManageDrawerProps {
  userId: number;
  onClose: () => void;
  /** Something about this account changed (or it was deleted): the list behind the drawer should re-read itself. */
  onChanged: () => void;
  triggerToast: ToastTrigger;
  initialTab?: Tab;
}

/**
 * Everything the superadmin can know and do about ONE account, whatever its role,
 * in one place: who they are and how to correct it, what plan they hold and the
 * hand tools for it, how they sign in (reset, sign out, view as, block, delete),
 * and what has been done to them. Opened from the Students, Leads, Accounts and
 * Subscriptions tabs, so no screen needs its own half-copy of these controls.
 *
 * Each section re-reads the account after it changes something, so what is on
 * screen is always what the server holds — never an optimistic guess.
 */
export function UserManageDrawer({ userId, onClose, onChanged, triggerToast, initialTab = "overview" }: UserManageDrawerProps) {
  const [data, setData] = useState<ManagedUserResponse | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const managed = await api.get<ManagedUserResponse>(`/superadmin/users/${userId}/manage`);
      setData(managed);

      // A student's performance numbers come from the older detail endpoint; they are an extra, never a blocker.
      if (managed.user.role === "user") {
        api
          .get<StudentDetail>(`/superadmin/users/${userId}/detail`)
          .then(setDetail)
          .catch(() => setDetail(null));
      } else {
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this account.");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The parent passes a fresh onClose on every render of the list behind the drawer; reading it through a ref
  // keeps the listener (and, below, the one-time focus) from being redone — which would pull focus out of
  // whatever the superadmin is typing into each time that list refreshes.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape closes — unless a dialog opened from here is on top (it handles its own Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])')) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Move focus into the drawer once, when it opens, so the keyboard works from the first press.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const reload = useCallback(async () => {
    await load();
    onChanged();
  }, [load, onChanged]);

  const user = data?.user;
  const role = user ? roleInfo(user.role) : null;
  const plan = data?.plan?.coverage.plan;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        data-drawer
        aria-label={user ? `Manage ${user.name}` : "Manage account"}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative flex h-full w-full max-w-xl flex-col border-l border-border-strong bg-surface shadow-2xl outline-none"
      >
        <div className="border-b border-border-subtle p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent-primary/30 bg-gradient-to-br from-accent-primary/25 to-accent-secondary/15 text-base font-black text-accent-primary">
              {user ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "…"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-extrabold text-primary">{user?.name ?? "Loading…"}</h3>
              <p className="truncate font-mono text-2xs text-text-muted">{user?.email}</p>
              {user && role && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold", role.badge)}>{role.label}</span>
                  {plan && (
                    <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary">
                      {plan.name}
                      {data?.plan?.covered_by_college ? " · via college" : ""}
                    </span>
                  )}
                  <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold", user.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success")}>
                    {user.is_blocked ? "Blocked" : "Active"}
                  </span>
                  {data?.login.password_state === "temporary" && <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-3xs font-bold text-status-warning">Never signed in</span>}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void load()}
                aria-label="Refresh"
                className="rounded-control p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-primary"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-control p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div role="tablist" aria-label="Account sections" className="-mb-4 mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`manage-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="manage-panel"
                onClick={() => setTab(t.id)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-bold transition-colors",
                  tab === t.id ? "border-accent-primary text-accent-primary" : "border-transparent text-text-secondary hover:text-primary"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div id="manage-panel" role="tabpanel" aria-labelledby={`manage-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-5">
          {error && !data ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
              <span>{error}</span>
              <button type="button" onClick={() => void load()} className="font-bold hover:underline">
                Retry
              </button>
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
            </div>
          ) : (
            <>
              {tab === "overview" && <OverviewSection data={data} reload={reload} triggerToast={triggerToast} detail={detail} />}
              {tab === "plan" && <PlanSection data={data} reload={reload} triggerToast={triggerToast} />}
              {tab === "security" && (
                <SecuritySection
                  data={data}
                  reload={reload}
                  triggerToast={triggerToast}
                  onDeleted={() => {
                    onChanged();
                    onClose();
                  }}
                />
              )}
              {tab === "activity" && <ActivitySection data={data} />}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
