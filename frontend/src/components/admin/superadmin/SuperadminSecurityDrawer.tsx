"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  Eye,
  Globe,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { type ToastTrigger } from "@/lib/toast";
import { formatDateTime } from "./types";
import { timeAgo } from "./manage/shared";
import {
  eventMeta,
  formatLocation,
  type SuperadminDetailResponse,
  type SuperadminLoginLog,
  type SuperadminTrustedDevice,
} from "./superadminSecurityTypes";
import { LoginTelemetryDetailModal } from "./LoginTelemetryDetailModal";
import { TrustDeviceModal } from "./TrustDeviceModal";
import { DeleteSuperadminModal } from "./DeleteSuperadminModal";
import { Modal } from "@/components/ui/Modal";

interface SuperadminSecurityDrawerProps {
  userId: number;
  onClose: () => void;
  onChanged: () => void;
  triggerToast: ToastTrigger;
}

type DrawerTab = "logins" | "trusted" | "sessions";

export function SuperadminSecurityDrawer({ userId, onClose, onChanged, triggerToast }: SuperadminSecurityDrawerProps) {
  const [data, setData] = useState<SuperadminDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("logins");
  const [inspectLog, setInspectLog] = useState<SuperadminLoginLog | null>(null);
  const [trustPrefill, setTrustPrefill] = useState<SuperadminLoginLog | null | "manual">(null);
  const [showDelete, setShowDelete] = useState(false);

  // Password-confirmed security actions
  const [policyConfirm, setPolicyConfirm] = useState<{ nextValue: boolean } | null>(null);
  const [removeDeviceTarget, setRemoveDeviceTarget] = useState<SuperadminTrustedDevice | null>(null);
  const [revokeTokenId, setRevokeTokenId] = useState<number | null>(null);
  const [actionPassword, setActionPassword] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<SuperadminDetailResponse>(`/superadmin/superadmins/${userId}`);
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load superadmin security details.");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadAll = async () => {
    await load();
    onChanged();
  };

  const resetActionModal = () => {
    setPolicyConfirm(null);
    setRemoveDeviceTarget(null);
    setRevokeTokenId(null);
    setActionPassword("");
    setActionError(null);
    setActionBusy(false);
  };

  const handleConfirmSecurityAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionPassword) return;
    setActionBusy(true);
    setActionError(null);

    try {
      if (policyConfirm) {
        await api.post(`/superadmin/superadmins/${userId}/security-policy`, {
          password: actionPassword,
          enforce_trusted_login: policyConfirm.nextValue,
        });
        triggerToast(
          policyConfirm.nextValue
            ? "Strict Laptop & IP login lock enabled."
            : "Strict Laptop & IP login lock disabled (monitoring only)."
        );
      } else if (removeDeviceTarget) {
        await api.delete(`/superadmin/superadmins/${userId}/trusted-devices/${removeDeviceTarget.id}`, {
          password: actionPassword,
        });
        triggerToast(`Removed trusted rule "${removeDeviceTarget.label}".`);
      } else if (revokeTokenId !== null) {
        await api.post(`/superadmin/superadmins/${userId}/revoke-session/${revokeTokenId}`, {
          password: actionPassword,
        });
        triggerToast("Session revoked.");
      }
      resetActionModal();
      await reloadAll();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.errors?.password?.[0] ??
            err.errors?.enforce_trusted_login?.[0] ??
            err.errors?.device?.[0] ??
            err.errors?.session?.[0] ??
            err.message
          : "Security action failed."
      );
      setActionBusy(false);
    }
  };

  const sa = data?.superadmin;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={sa ? `Security for ${sa.name}` : "Superadmin security"}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative flex h-full w-full max-w-2xl flex-col border-l border-border-strong bg-surface shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="border-b border-border-subtle p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-sm font-black text-amber-500">
              {sa ? sa.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-extrabold text-primary">{sa?.name ?? "Loading…"}</h3>
                {sa?.is_self && (
                  <span className="rounded-full bg-accent-primary/15 px-2 py-0.5 text-3xs font-bold text-accent-primary">You</span>
                )}
              </div>
              <p className="truncate font-mono text-2xs text-text-muted">{sa?.email}</p>
              {sa && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-3xs font-bold text-amber-500">
                    Superadmin
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-3xs font-bold",
                      sa.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                    )}
                  >
                    {sa.is_blocked ? <Ban className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {sa.is_blocked ? "Blocked" : "Active"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-3xs font-bold",
                      sa.enforce_trusted_login
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-border-subtle bg-elevated text-text-muted"
                    )}
                  >
                    {sa.enforce_trusted_login ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {sa.enforce_trusted_login ? "Strict Laptop+IP Lock ON" : "Monitoring Mode"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {sa?.can_delete && (
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="inline-flex items-center gap-1 rounded-control border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-3xs font-bold text-status-danger hover:bg-status-danger/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => void load()}
                aria-label="Refresh"
                className="rounded-control p-1.5 text-text-muted hover:bg-surface-hover hover:text-primary"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-control p-1.5 text-text-muted hover:bg-surface-hover hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="-mb-4 mt-4 flex gap-1 overflow-x-auto">
            {(
              [
                { id: "logins", label: `Login History (${data?.login_logs.length ?? 0})` },
                { id: "trusted", label: `Trusted Laptops & IPs (${data?.trusted_devices.length ?? 0})` },
                { id: "sessions", label: `Active Sessions (${data?.sessions.length ?? 0})` },
              ] as { id: DrawerTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
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

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-xs">
          {error && !data ? (
            <div className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-status-danger">{error}</div>
          ) : !data ? (
            <div className="flex items-center justify-center gap-2 p-10 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading superadmin telemetry…
            </div>
          ) : (
            <>
              {tab === "logins" && (
                <div className="space-y-3">
                  {data.login_logs.length === 0 ? (
                    <div className="rounded-panel border border-border-subtle bg-elevated/40 p-6 text-center text-text-muted">
                      No login events recorded for this superadmin yet. New sign-ins capture full IP, network, browser, laptop, GPU, and hardware fingerprint details.
                    </div>
                  ) : (
                    data.login_logs.map((log) => {
                      const meta = eventMeta(log.event);
                      return (
                        <div key={log.id} className="rounded-panel border border-border-subtle bg-elevated/40 p-3.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold", meta.badge)}>{meta.label}</span>
                              {log.reason && <span className="text-3xs font-semibold text-status-danger">({log.reason})</span>}
                            </div>
                            <span className="text-3xs text-text-muted" title={formatDateTime(log.created_at)}>
                              {formatDateTime(log.created_at)} · {timeAgo(log.created_at)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs">
                            <div className="rounded-control border border-border-subtle bg-surface px-2.5 py-2 space-y-0.5">
                              <div className="text-3xs font-bold uppercase text-text-muted">IP &amp; Network</div>
                              <div className="font-mono font-bold text-primary">{log.ip_address ?? "—"}</div>
                              <div className="text-text-secondary truncate">
                                {[log.isp, log.asn].filter(Boolean).join(" · ") || (log.is_private_ip ? "Private / LAN" : "—")}
                              </div>
                              <div className="text-text-muted flex items-center gap-1 truncate">
                                <Globe className="h-3 w-3 shrink-0" />
                                {formatLocation(log)}
                                {log.network_type || log.effective_type ? ` · ${log.network_type ?? log.effective_type?.toUpperCase()}` : ""}
                              </div>
                            </div>

                            <div className="rounded-control border border-border-subtle bg-surface px-2.5 py-2 space-y-0.5">
                              <div className="text-3xs font-bold uppercase text-text-muted">Laptop &amp; Browser</div>
                              <div className="font-semibold text-primary flex items-center gap-1 truncate">
                                <Laptop className="h-3 w-3 shrink-0 text-accent-primary" />
                                {[log.os, log.os_version].filter(Boolean).join(" ") || "Unknown OS"} · {[log.browser, log.browser_version].filter(Boolean).join(" ") || "Unknown Browser"}
                              </div>
                              <div className="text-text-secondary truncate">{log.gpu_renderer ?? "GPU not reported"}</div>
                              <div className="font-mono text-3xs text-text-muted truncate">
                                FP: {log.device_fingerprint ? `${log.device_fingerprint.slice(0, 18)}…` : "—"}
                                {log.screen_resolution ? ` · ${log.screen_resolution}` : ""}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setInspectLog(log)}
                              className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-3xs font-bold text-primary hover:bg-surface-hover"
                            >
                              <Eye className="h-3 w-3" /> Full Details
                            </button>
                            {(log.ip_address || log.device_fingerprint) && (
                              <button
                                type="button"
                                onClick={() => setTrustPrefill(log)}
                                className="inline-flex items-center gap-1 rounded-control border border-accent-primary/30 bg-accent-primary/10 px-2.5 py-1 text-3xs font-bold text-accent-primary hover:bg-accent-primary/20"
                              >
                                <ShieldCheck className="h-3 w-3" /> Trust Laptop &amp; IP
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === "trusted" && sa && (
                <div className="space-y-4">
                  <div className="rounded-panel border border-border-subtle bg-elevated/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-primary flex items-center gap-1.5">
                          {sa.enforce_trusted_login ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                          )}
                          <span>Strict Laptop &amp; IP Allowlist Lock</span>
                        </div>
                        <p className="mt-0.5 text-2xs text-text-muted">
                          {sa.enforce_trusted_login
                            ? "Active: This superadmin can ONLY sign in from an approved laptop and IP below."
                            : "Monitoring only (ready for future enforcement): logins from any laptop/IP are allowed and fully logged."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPolicyConfirm({ nextValue: !sa.enforce_trusted_login })}
                        className={cn(
                          "rounded-control px-3 py-1.5 text-xs font-bold border transition-colors",
                          sa.enforce_trusted_login
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        )}
                      >
                        {sa.enforce_trusted_login ? "Disable Strict Lock" : "Enable Strict Lock"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-primary">Approved Laptops &amp; IP Rules</h4>
                    <button
                      type="button"
                      onClick={() => setTrustPrefill("manual")}
                      className="inline-flex items-center gap-1 rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white hover:bg-accent-primary-hover"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Trusted Laptop / IP
                    </button>
                  </div>

                  {data.trusted_devices.length === 0 ? (
                    <div className="rounded-panel border border-dashed border-border-strong p-6 text-center text-text-muted">
                      No trusted laptops or IPs added yet. Open any login record and click &ldquo;Trust Laptop &amp; IP&rdquo; or add one manually.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.trusted_devices.map((d) => (
                        <div key={d.id} className="rounded-panel border border-border-subtle bg-elevated/40 p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="font-bold text-primary">{d.label}</div>
                            <div className="flex flex-wrap gap-2 text-2xs font-mono text-text-secondary">
                              <span>IP: {d.ip_address ?? "Any"}</span>
                              {d.device_fingerprint && <span>FP: {d.device_fingerprint.slice(0, 16)}…</span>}
                            </div>
                            <div className="text-3xs text-text-muted">
                              {[d.os, d.browser, d.gpu_renderer].filter(Boolean).join(" · ") || "Manual rule"}
                              {d.last_matched_at ? ` · Last matched ${timeAgo(d.last_matched_at)}` : " · Never matched yet"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRemoveDeviceTarget(d)}
                            className="shrink-0 rounded-control border border-status-danger/30 bg-status-danger/10 p-1.5 text-status-danger hover:bg-status-danger/20"
                            title="Remove rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "sessions" && (
                <div className="space-y-3">
                  {data.sessions.length === 0 ? (
                    <div className="rounded-panel border border-border-subtle bg-elevated/40 p-6 text-center text-text-muted">
                      No active Sanctum sessions.
                    </div>
                  ) : (
                    data.sessions.map((s) => (
                      <div key={s.id} className="rounded-panel border border-border-subtle bg-elevated/40 p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-primary">Session #{s.id}</span>
                            <span className="ml-2 text-3xs text-text-muted">
                              Started {timeAgo(s.created_at)} · Last used {s.last_used_at ? timeAgo(s.last_used_at) : "never"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRevokeTokenId(s.id)}
                            className="inline-flex items-center gap-1 rounded-control border border-status-danger/30 bg-status-danger/10 px-2.5 py-1 text-3xs font-bold text-status-danger hover:bg-status-danger/20"
                          >
                            <LogOut className="h-3 w-3" /> Revoke
                          </button>
                        </div>
                        {s.login_context ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs text-text-secondary">
                            <div>
                              <span className="text-text-muted">IP:</span>{" "}
                              <span className="font-mono text-primary">{s.login_context.ip_address ?? "—"}</span>
                              {s.login_context.isp ? ` (${s.login_context.isp})` : ""}
                            </div>
                            <div>
                              <span className="text-text-muted">Device:</span> {s.login_context.device_label ?? "—"}
                            </div>
                          </div>
                        ) : (
                          <div className="text-2xs text-text-muted">Issued before login telemetry tracking was enabled.</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {inspectLog && (
        <LoginTelemetryDetailModal
          log={inspectLog}
          onClose={() => setInspectLog(null)}
          onTrustDevice={(l) => {
            setInspectLog(null);
            setTrustPrefill(l);
          }}
        />
      )}

      {trustPrefill !== null && sa && (
        <TrustDeviceModal
          userId={sa.id}
          accountLabel={sa.name}
          prefill={trustPrefill === "manual" ? null : trustPrefill}
          onClose={() => setTrustPrefill(null)}
          onAdded={() => {
            setTrustPrefill(null);
            void reloadAll();
          }}
          triggerToast={triggerToast}
        />
      )}

      {showDelete && sa && (
        <DeleteSuperadminModal
          account={{ id: sa.id, name: sa.name, email: sa.email }}
          onClose={() => setShowDelete(false)}
          onDeleted={(deletedName) => {
            setShowDelete(false);
            triggerToast(`Deleted superadmin account ${deletedName}.`);
            onChanged();
            onClose();
          }}
        />
      )}

      {(policyConfirm || removeDeviceTarget || revokeTokenId !== null) && (
        <Modal
          onClose={() => !actionBusy && resetActionModal()}
          title={
            policyConfirm
              ? policyConfirm.nextValue
                ? "Enable Strict Laptop & IP Lock"
                : "Disable Strict Laptop & IP Lock"
              : removeDeviceTarget
              ? "Remove Trusted Laptop / IP Rule"
              : "Revoke Active Session"
          }
          subtitle="Re-enter your superadmin password to confirm this security change."
          icon={ShieldCheck}
          size="md"
          closeOnBackdrop={false}
          footer={
            <>
              <button
                type="button"
                onClick={resetActionModal}
                disabled={actionBusy}
                className="rounded-control border border-border-subtle px-4 py-2 text-xs text-text-muted hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sa-security-confirm-form"
                disabled={actionBusy || !actionPassword}
                className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-50"
              >
                {actionBusy ? "Confirming..." : "Confirm"}
              </button>
            </>
          }
        >
          <form id="sa-security-confirm-form" onSubmit={handleConfirmSecurityAction} className="space-y-3 text-xs">
            <input
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={actionPassword}
              onChange={(e) => setActionPassword(e.target.value)}
              placeholder="Your superadmin password"
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-accent-primary"
            />
            {actionError && (
              <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-2.5 font-semibold text-status-danger">
                {actionError}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
