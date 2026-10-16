"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Search,
  Users2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { Modal } from "@/components/ui/Modal";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminVaultProfile, AdminVaultSummary, AdminVaultSyncEvent, Paginated, VaultStatus } from "@/types/vault";

const STATUS_LABEL: Record<VaultStatus, string> = {
  not_ready: "Not ready",
  upgrade_required: "Ready — needs plan",
  pending_consent: "Awaiting consent",
  visible: "Live",
  hidden_by_candidate: "Hidden (student)",
  hidden_by_mellow: "Hidden (Mellow)",
  hired: "Hired",
};

const STATUS_BADGE: Record<VaultStatus, string> = {
  not_ready: "bg-elevated text-text-muted",
  upgrade_required: "bg-sky-500/15 text-sky-400",
  pending_consent: "bg-status-warning/15 text-status-warning",
  visible: "bg-status-success/15 text-status-success",
  hidden_by_candidate: "bg-elevated text-text-muted",
  hidden_by_mellow: "bg-status-danger/15 text-status-danger",
  hired: "bg-accent-primary/15 text-accent-primary",
};

const EVENT_BADGE: Record<AdminVaultSyncEvent["status"], string> = {
  pending: "bg-status-warning/15 text-status-warning",
  processing: "bg-sky-500/15 text-sky-400",
  delivered: "bg-status-success/15 text-status-success",
  failed: "bg-status-warning/15 text-status-warning",
  dead: "bg-status-danger/15 text-status-danger",
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";

type Tab = "overview" | "students" | "sync";

/**
 * Mellow staff's oversight of the Vault — see AdminVaultController. Nothing is
 * authored here: a student gets in by reaching the readiness bar and saying yes.
 * This page is who is ready and who is live, a policy override to hide a profile
 * (with a recorded reason), and the state of the hand-off to Mellow Vault — is it
 * connected, is anything stuck, and a button to retry what gave up.
 */
export default function AdminVaultPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "vault");

  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_internal"
      title="Vault"
      subtitle="Students whose readiness says they're ready to be hired — who is live, and the hand-off to Mellow Vault."
    >
      {toast && (
        <div role="status" className="fixed right-6 top-20 z-50 max-w-sm rounded-panel border border-accent-primary/40 bg-surface px-4 py-3 text-xs font-semibold text-primary shadow-card">
          {toast}
        </div>
      )}

      {!hasAccess ? (
        <AccessDeniedNotice section="the Vault" />
      ) : (
        <>
          <div className="flex w-fit items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1">
            {(
              [
                ["overview", "Overview"],
                ["students", "Students"],
                ["sync", "Mellow Vault sync"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={cn("rounded-control px-4 py-1.5 text-xs font-bold transition-colors", tab === id ? "bg-accent-primary text-white shadow-subtle" : "text-text-muted hover:text-primary")}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" ? <OverviewTab onToast={showToast} onGo={setTab} /> : tab === "students" ? <StudentsTab onToast={showToast} /> : <SyncTab onToast={showToast} />}
        </>
      )}
    </DashboardShell>
  );
}

// ───────────────────────────── overview ─────────────────────────────

function OverviewTab({ onToast, onGo }: { onToast: (msg: string) => void; onGo: (tab: Tab) => void }) {
  const [summary, setSummary] = useState<AdminVaultSummary | null>(null);

  useEffect(() => {
    api
      .get<AdminVaultSummary>("/admin/vault/summary")
      .then(setSummary)
      .catch((err) => onToast(err instanceof ApiError ? err.message : "Failed to load the Vault summary."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary) return <Loading />;

  const { sync, by_status: counts } = summary;
  const stuck = sync.dead > 0;

  const stats: { label: string; value: number; hint: string }[] = [
    { label: "Eligible", value: summary.eligible, hint: `Readiness ≥ ${summary.thresholds.enter}` },
    { label: "Awaiting consent", value: counts.pending_consent, hint: "Ready, haven't said yes" },
    { label: "Ready, no Vault plan", value: counts.upgrade_required, hint: "Eligible, but not on Expert or Grandmaster" },
    { label: "Live in the Vault", value: counts.visible, hint: "Visible to hiring partners" },
    { label: "Live on Mellow Vault", value: summary.listed_on_mellow_vault, hint: "Mellow Vault acknowledged" },
    { label: "Hired", value: counts.hired, hint: "Through the Vault" },
    { label: "Hidden by Mellow", value: counts.hidden_by_mellow, hint: "Policy override" },
  ];

  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
            <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">{s.label}</div>
            <div className="mt-1 font-mono text-2xl font-black text-primary">{s.value}</div>
            <div className="mt-0.5 text-2xs text-text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
            <PlugZap className="h-4 w-4 text-accent-primary" aria-hidden />
            Mellow Vault connection
          </h2>
          <span className={cn("rounded-control px-2.5 py-1 text-2xs font-bold", sync.configured ? "bg-status-success/15 text-status-success" : "bg-status-warning/15 text-status-warning")}>
            {sync.configured ? "Connected" : "Not connected"}
          </span>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          <Check ok={sync.url_set} label="VAULT_SYNC_URL" hint="Where profiles are sent" />
          <Check ok={sync.secret_set} label="VAULT_SYNC_SECRET" hint="Signs every delivery" />
          <Check ok={sync.api_key_set} label="VAULT_API_KEY" hint="Lets Mellow Vault call AptRun" />
        </ul>

        {!sync.configured && (
          <p className="mt-3 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-2xs leading-relaxed text-text-secondary">
            Nothing is being sent to Mellow Vault yet — and nothing is lost: every change is kept and goes out the moment both <strong>VAULT_SYNC_URL</strong> and <strong>VAULT_SYNC_SECRET</strong> are set in the server&apos;s <code>.env</code>.
            Students who agreed to be found are still visible to hiring partners on AptRun in the meantime.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Waiting" value={sync.pending} />
          <Fact label="Retrying" value={sync.retrying} tone={sync.retrying > 0 ? "warn" : undefined} />
          <Fact label="Gave up" value={sync.dead} tone={stuck ? "bad" : undefined} />
          <Fact label="Delivered (24h)" value={sync.delivered_24h} />
        </dl>

        {sync.oldest_waiting_minutes !== null && sync.oldest_waiting_minutes >= 10 && sync.configured && (
          <p className="mt-3 flex items-center gap-2 text-2xs font-semibold text-status-warning">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            The oldest update has been waiting {sync.oldest_waiting_minutes} minutes. Check the sync tab, and that the scheduler cron is running.
          </p>
        )}

        {(stuck || sync.retrying > 0) && (
          <button onClick={() => onGo("sync")} className="mt-3 text-2xs font-bold text-accent-primary hover:underline">
            Open the sync log →
          </button>
        )}
      </section>

      <p className="text-2xs leading-relaxed text-text-muted">
        A student becomes eligible at a readiness score of {summary.thresholds.enter} and stays eligible until it drops below {summary.thresholds.exit}. Eligibility only lists someone once they are on a plan that includes the Vault (Expert or Grandmaster, or a college plan that covers them) and have said yes themselves.
      </p>
    </div>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className={cn("flex items-start gap-2 rounded-control border p-3", ok ? "border-status-success/25 bg-status-success/5" : "border-border-subtle bg-elevated/60")}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />}
      <div>
        <div className="font-mono text-2xs font-bold text-primary">{label}</div>
        <div className="text-3xs text-text-muted">{ok ? "Set" : "Not set"} · {hint}</div>
      </div>
    </li>
  );
}

function Fact({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-control bg-elevated/60 px-3 py-2.5 ring-1 ring-inset ring-border-subtle">
      <dt className="text-3xs font-bold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-lg font-black", tone === "bad" ? "text-status-danger" : tone === "warn" ? "text-status-warning" : "text-primary")}>{value}</dd>
    </div>
  );
}

// ───────────────────────────── students ─────────────────────────────

function StudentsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [result, setResult] = useState<Paginated<AdminVaultProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minReadiness, setMinReadiness] = useState("");
  const [page, setPage] = useState(1);
  const [hiding, setHiding] = useState<AdminVaultProfile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("visibility_status", statusFilter);
      if (minReadiness) params.set("min_readiness", minReadiness);
      params.set("page", String(page));
      const res = await api.get<{ profiles: Paginated<AdminVaultProfile> }>(`/admin/vault/profiles?${params.toString()}`);
      setResult(res.profiles);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load students.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, minReadiness, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const unhide = async (row: AdminVaultProfile) => {
    try {
      await api.post(`/admin/vault/profiles/${row.id}/visibility`, { action: "unhide" });
      onToast("Profile unhidden.");
      void load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to unhide.");
    }
  };

  const resync = async (row: AdminVaultProfile) => {
    try {
      await api.post(`/admin/vault/profiles/${row.id}/resync`);
      onToast("Queued to be sent to Mellow Vault again.");
      void load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to re-sync.");
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search by name or email..."
            aria-label="Search students"
            className="w-full rounded-control border border-border-subtle bg-elevated py-2 pl-8 pr-3 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          aria-label="Filter by status"
          className="rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as VaultStatus[]).map((k) => (
            <option key={k} value={k}>{STATUS_LABEL[k]}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          value={minReadiness}
          onChange={(e) => { setPage(1); setMinReadiness(e.target.value); }}
          placeholder="Min readiness"
          aria-label="Minimum readiness"
          className="w-36 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
        />
      </div>

      {loading && !result ? (
        <Loading />
      ) : !result || result.data.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">No students match this filter yet.</div>
      ) : (
        <div className={cn("overflow-x-auto rounded-panel border border-border-subtle bg-surface transition-opacity", loading && "opacity-60")}>
          <table className="w-full text-xs">
            <thead className="bg-elevated/60 text-3xs font-bold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left">Student</th>
                <th className="px-4 py-2.5 text-left">College</th>
                <th className="px-4 py-2.5 text-left">Readiness</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Mellow Vault</th>
                <th className="px-4 py-2.5 text-left">Interest</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {result.data.map((row) => (
                <tr key={row.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary">{row.user?.name ?? "—"}</div>
                    <div className="text-3xs text-text-muted">{row.user?.email}</div>
                    {row.user?.is_blocked && <div className="text-3xs font-bold text-status-danger">Account blocked</div>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.user?.college?.name ?? "Mellow Direct"}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-accent-primary">{row.readiness_score}</div>
                    <div className="text-3xs text-text-muted">peak {row.peak_readiness}{row.qualification_source === "legacy_contest" ? " · from Talent Pool" : ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded px-1.5 py-0.5 text-3xs font-bold", STATUS_BADGE[row.visibility_status])}>{STATUS_LABEL[row.visibility_status]}</span>
                    {row.hired_by_company && <div className="mt-0.5 text-3xs text-text-muted">by {row.hired_by_company.name}</div>}
                    {row.hired_via === "mellow_vault" && <div className="mt-0.5 text-3xs text-text-muted">on Mellow Vault{row.hired_employer_name ? ` · ${row.hired_employer_name}` : ""}</div>}
                    {row.visibility_status === "hidden_by_mellow" && row.hidden_reason && <div className="mt-0.5 max-w-[180px] truncate text-3xs text-text-muted" title={row.hidden_reason}>“{row.hidden_reason}”</div>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {row.vault_listed_at ? <span className="font-semibold text-status-success">Listed</span> : row.sync_state === "idle" ? "—" : <span className={row.sync_state === "failed" ? "font-semibold text-status-danger" : ""}>{row.sync_state}</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="flex items-center gap-1"><Users2 className="h-3 w-3" aria-hidden />{row.inquiries_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {row.visibility_status === "visible" && (
                        <button onClick={() => resync(row)} title="Send this profile to Mellow Vault again" className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary">
                          <RefreshCw className="h-3 w-3" aria-hidden /> Re-sync
                        </button>
                      )}
                      {row.visibility_status === "hidden_by_mellow" && row.hidden_by_staff_at ? (
                        <button onClick={() => unhide(row)} className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary">
                          <Eye className="h-3 w-3" aria-hidden /> Unhide
                        </button>
                      ) : (
                        row.visibility_status !== "hired" && (
                          <button onClick={() => setHiding(row)} className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-primary">
                            <EyeOff className="h-3 w-3" aria-hidden /> Hide
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-control border border-border-subtle px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40">Prev</button>
          <span className="text-xs text-text-muted">Page {result.current_page} of {result.last_page}</span>
          <button disabled={page >= result.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-control border border-border-subtle px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40">Next</button>
        </div>
      )}

      {hiding && (
        <HideModal
          row={hiding}
          onClose={() => setHiding(null)}
          onDone={() => {
            setHiding(null);
            onToast("Profile hidden from hiring partners and Mellow Vault.");
            void load();
          }}
        />
      )}
    </div>
  );
}

function HideModal({ row, onClose, onDone }: { row: AdminVaultProfile; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/admin/vault/profiles/${row.id}/visibility`, { action: "hide", reason: reason.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to hide this profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Hide this profile"
      subtitle={row.user?.name ?? undefined}
      icon={EyeOff}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-control border border-border-subtle px-4 py-2 text-xs font-bold text-text-secondary">Cancel</button>
          <button type="submit" form="vault-hide-form" disabled={saving} className="flex items-center gap-1.5 rounded-control bg-status-danger px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Hide profile
          </button>
        </>
      }
    >
      <form id="vault-hide-form" onSubmit={submit} className="space-y-3">
        <p className="text-2xs leading-relaxed text-text-secondary">
          The student disappears from every hiring partner&apos;s search at once, and Mellow Vault is told to take the profile down. The student is not told why. Only you can undo this — it does not override a student who hid their own profile.
        </p>
        <label className="block">
          <span className="text-2xs font-bold text-text-secondary">Reason (kept in the audit log)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="e.g. Resume appears to belong to someone else"
            className="mt-1 w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </label>
        {error && <p role="alert" className="text-2xs font-semibold text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

// ───────────────────────────── sync log ─────────────────────────────

function SyncTab({ onToast }: { onToast: (msg: string) => void }) {
  const [result, setResult] = useState<Paginated<AdminVaultSyncEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("page", String(page));
      const res = await api.get<{ events: Paginated<AdminVaultSyncEvent> }>(`/admin/vault/sync-events?${params.toString()}`);
      setResult(res.events);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load the sync log.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (eventId?: number) => {
    setBusy(true);
    try {
      const res = await api.post<{ requeued: number }>("/admin/vault/sync-events/retry", eventId ? { event_id: eventId } : undefined);
      onToast(res.requeued > 0 ? `${res.requeued} update${res.requeued === 1 ? "" : "s"} queued to retry.` : "Nothing to retry.");
      void load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to retry.");
    } finally {
      setBusy(false);
    }
  };

  const hasDead = result?.data.some((e) => e.status === "dead") ?? false;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          aria-label="Filter by status"
          className="rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
        >
          <option value="">Not yet delivered</option>
          <option value="dead">Gave up</option>
          <option value="failed">Retrying</option>
          <option value="pending">Waiting</option>
          <option value="delivered">Delivered</option>
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-2xs font-bold text-text-secondary hover:text-primary">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
          </button>
          {hasDead && (
            <button onClick={() => retry()} disabled={busy} className="flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-2 text-2xs font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden />}
              Retry all that gave up
            </button>
          )}
        </div>
      </div>

      {loading && !result ? (
        <Loading />
      ) : !result || result.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">
          <Award className="h-5 w-5 text-status-success" aria-hidden />
          Nothing stuck — every update has been delivered or is on its way.
        </div>
      ) : (
        <div className={cn("overflow-x-auto rounded-panel border border-border-subtle bg-surface transition-opacity", loading && "opacity-60")}>
          <table className="w-full text-xs">
            <thead className="bg-elevated/60 text-3xs font-bold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left">Update</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Attempts</th>
                <th className="px-4 py-2.5 text-left">Next try</th>
                <th className="px-4 py-2.5 text-left">Last error</th>
                <th className="px-4 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {result.data.map((e) => (
                <tr key={e.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary">{e.type === "profile.upsert" ? "List / update profile" : `Take down${e.reason ? ` · ${e.reason.replace(/_/g, " ")}` : ""}`}</div>
                    <div className="font-mono text-3xs text-text-muted">{e.profile}</div>
                  </td>
                  <td className="px-4 py-3"><span className={cn("rounded px-1.5 py-0.5 text-3xs font-bold", EVENT_BADGE[e.status])}>{e.status === "dead" ? "gave up" : e.status === "failed" ? "retrying" : e.status}</span></td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{e.attempts}</td>
                  <td className="px-4 py-3 text-text-secondary">{e.status === "delivered" ? fmt(e.delivered_at) : e.status === "dead" ? "—" : fmt(e.available_at)}</td>
                  <td className="max-w-[260px] px-4 py-3 text-text-muted">
                    {e.last_error ? <span className="line-clamp-2" title={e.last_error}>{e.last_error}</span> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.status === "dead" && (
                      <button onClick={() => retry(e.id)} disabled={busy} className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-secondary hover:text-primary disabled:opacity-60">
                        <RotateCcw className="h-3 w-3" aria-hidden /> Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-control border border-border-subtle px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40">Prev</button>
          <span className="text-xs text-text-muted">Page {result.current_page} of {result.last_page}</span>
          <button disabled={page >= result.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-control border border-border-subtle px-3 py-1.5 text-xs text-text-secondary disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-8 text-xs text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      Loading...
    </div>
  );
}
