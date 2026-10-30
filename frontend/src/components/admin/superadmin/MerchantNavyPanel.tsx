"use client";

import { useCallback, useEffect, useState } from "react";
import { Anchor, BookOpen, CheckCircle2, EyeOff, History, LayoutDashboard, Loader2, Mic, ShieldCheck } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { api, ApiError } from "@/lib/api";
import { confirmDialog } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";

interface ModuleContent {
  key: string;
  name: string;
  live: boolean;
  sets: number;
  questions: number;
}

interface PlatformModule {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  surfaces: { key: string; label: string; detail: string }[];
  content: ModuleContent[];
  updated_by_name: string | null;
  updated_at: string | null;
}

interface HistoryRow {
  id: number;
  action: string;
  enabled: boolean;
  actor_name: string;
  at: string;
}

const KEY = "merchant_navy";

const SURFACE_ICON: Record<string, typeof Anchor> = { sidebar: LayoutDashboard, mock_card: Mic };

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Superadmin -> Merchant Navy: ONE switch that shows or hides the whole Merchant Navy section for every student on AptRun - the sidebar
 * group and its page, and the "Merchant Navy" card in the Mock AI Interview. It is enforced by the server (a hidden domain cannot be
 * started by calling the API directly) and open student screens follow within seconds, with no refresh.
 *
 * The switch is explicit (on / off), never a blind flip, so two admins or two tabs can't undo each other by accident.
 */
export function MerchantNavyPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [mod, setMod] = useState<PlatformModule | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api
      .get<{ modules: PlatformModule[]; history: HistoryRow[] }>("/superadmin/platform-modules")
      .then((res) => {
        setMod(res.modules.find((m) => m.key === KEY) ?? null);
        setHistory(res.history);
      })
      .catch((err) => {
        setFailed(true);
        triggerToast(err instanceof ApiError ? err.message : "Couldn't load the Merchant Navy switch.", "error");
      })
      .finally(() => setLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (enabled: boolean) => {
    if (!mod || saving) return;

    if (!enabled) {
      const ok = await confirmDialog({
        title: "Deactivate Merchant Navy for every student?",
        message: "It disappears from every student's sidebar and from Mock AI Interview within seconds, and nobody can start a new sitting.",
        items: ["A student already in the middle of a sitting can finish it.", "Their earlier results are kept.", "You can switch it back on at any time."],
        confirmLabel: "Deactivate",
        tone: "warning",
      });
      if (!ok) return;
    } else if (!mod.content.some((c) => c.live)) {
      const ok = await confirmDialog({
        title: "No exam is open yet",
        message: "Merchant Navy has no exam with enough questions, so students would see an empty section. Activate it anyway?",
        confirmLabel: "Activate anyway",
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ module: PlatformModule; changed: boolean; history: HistoryRow[] }>(`/superadmin/platform-modules/${KEY}`, { enabled });
      setMod(res.module);
      setHistory(res.history);
      triggerToast(
        !res.changed
          ? `Merchant Navy was already ${enabled ? "active" : "inactive"}.`
          : enabled
            ? "Merchant Navy is now active. Every student sees it within seconds."
            : "Merchant Navy is now inactive. It is hidden from every student."
      );
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't change it. Check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading Merchant Navy">
        <div className="h-36 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        <div className="h-48 animate-pulse rounded-panel border border-border-subtle bg-surface" />
      </div>
    );
  }

  if (failed || !mod) {
    return (
      <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center">
        <p className="text-sm font-bold text-primary">Couldn&apos;t load Merchant Navy</p>
        <p className="mt-1 text-xs text-text-muted">Check your connection, then try again.</p>
        <button type="button" onClick={load} className="mt-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary hover:text-primary">
          Retry
        </button>
      </div>
    );
  }

  const on = mod.enabled;
  const totalSets = mod.content.reduce((n, c) => n + c.sets, 0);
  const totalQuestions = mod.content.reduce((n, c) => n + c.questions, 0);

  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <Anchor className="h-5 w-5 shrink-0 text-accent-primary" />
          <span>Merchant Navy</span>
        </h2>
        <p className="mt-1 text-xs text-text-muted">Show or hide the whole Merchant Navy section for every student on AptRun, with one switch.</p>
      </div>

      {/* The switch */}
      <section
        aria-label="Merchant Navy status"
        className={cn(
          "flex flex-col gap-5 rounded-panel border p-5 shadow-subtle sm:flex-row sm:items-center sm:justify-between sm:p-6",
          on ? "border-status-success/30 bg-status-success/[0.06]" : "border-border-strong bg-surface"
        )}
      >
        <div className="flex min-w-0 items-start gap-4">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", on ? "bg-status-success/15 text-status-success" : "bg-elevated text-text-muted")}>
            {on ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <EyeOff className="h-6 w-6" aria-hidden />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-primary">{on ? "Active — students can see it" : "Inactive — hidden from every student"}</h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-3xs font-bold",
                  on ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-border-strong bg-elevated text-text-muted"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-status-success" : "bg-text-muted")} aria-hidden />
                {on ? "Live" : "Off"}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary">{mod.description}</p>
            {mod.updated_at && (
              <p className="mt-2 text-2xs text-text-muted">
                Last changed {when(mod.updated_at)}
                {mod.updated_by_name ? ` by ${mod.updated_by_name}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-text-muted" aria-hidden />}
          <span className="text-xs font-bold text-text-secondary" aria-hidden>
            {on ? "Active" : "Inactive"}
          </span>
          <Toggle checked={on} onChange={change} label="Merchant Navy section for all students" disabled={saving} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Where it shows */}
        <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-primary">Where students see it</h3>
          <p className="mt-0.5 text-2xs text-text-muted">One switch controls all of these together.</p>
          <ul className="mt-4 space-y-3">
            {mod.surfaces.map((s) => {
              const Icon = SURFACE_ICON[s.key] ?? BookOpen;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-primary">{s.label}</div>
                    <div className="truncate text-2xs text-text-muted">{s.detail}</div>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-3xs font-bold", on ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-border-strong bg-elevated text-text-muted")}>
                    {on ? "Visible" : "Hidden"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* What's inside */}
        <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="text-sm font-bold text-primary">What&apos;s inside</h3>
          <p className="mt-0.5 text-2xs text-text-muted">
            {totalSets} sets · {totalQuestions.toLocaleString()} questions across {mod.content.length} exams. Staff can keep editing the question bank while it is off.
          </p>
          <ul className="mt-4 divide-y divide-border-subtle">
            {mod.content.map((c) => (
              <li key={c.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-primary">{c.name}</div>
                  <div className="tabular text-2xs text-text-muted">
                    {c.sets} sets · {c.questions.toLocaleString()} questions
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-3xs font-bold", c.live ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-status-warning/30 bg-status-warning/10 text-status-warning")}>
                  {c.live ? "Open" : "Coming soon"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <ShieldCheck className="h-4 w-4 text-accent-primary" aria-hidden /> What happens when you switch it
          </h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-text-secondary marker:text-text-muted">
            <li>Open student screens update within about 30 seconds (instantly when they return to the tab) — no refresh, no sign-in.</li>
            <li>When off, the server refuses to start or re-sit a Merchant Navy sitting even if someone calls it directly.</li>
            <li>A student already inside a sitting can finish it. Past results are kept and come back when it is on.</li>
            <li>It never changes anyone&apos;s plan, usage or readiness score.</li>
          </ul>
        </section>

        <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <History className="h-4 w-4 text-accent-primary" aria-hidden /> Recent changes
          </h3>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-text-muted">Nobody has switched it yet. It has been on since it launched.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-subtle">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", h.enabled ? "bg-status-success" : "bg-text-muted")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-primary">{h.enabled ? "Activated" : "Deactivated"}</div>
                    <div className="truncate text-2xs text-text-muted">by {h.actor_name}</div>
                  </div>
                  <time dateTime={h.at} className="shrink-0 text-2xs text-text-muted">
                    {when(h.at)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
