"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Clock, KeyRound, LogOut, Pencil, ShieldAlert, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpPill, hpInput, hpLabel } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { api, ApiError } from "@/lib/api";
import { confirmDialog, promptDialog } from "@/lib/dialogs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CohortStudent } from "@/types/cohort";

interface ManageData {
  account: {
    id: number;
    email: string;
    activated: boolean;
    created_at: string | null;
    last_seen_at: string | null;
    sessions: number;
    is_blocked: boolean;
    blocked: { reason: string | null; at: string | null; by: string | null; by_role: string | null } | null;
  };
  plan: { name: string; covered_by_college: boolean; ends_at: string | null };
  vault_ai: { stack: string; status: string; average: number | null; attempt: number; max_attempts: number }[];
  can_remove: boolean;
  remove_blocker: string | null;
  history: { action: string; by: string | null; role: string | null; at: string | null; reason: string | null }[];
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";
}

/**
 * "Manage account" for one of the TPO's own students: the account at a glance, and the things a college administrator needs
 * to be able to do without calling anyone — correct a wrong detail, block and unblock, send a new login, sign them out of every
 * device, remove an account added by mistake. The server decides what is allowed (and refuses everything outside the college);
 * a password is never shown here, a new login goes straight to the student's inbox.
 */
export function StudentManagePanel({
  student,
  onChanged,
  onRemoved,
}: {
  student: CohortStudent;
  /** The student's refreshed roster row after an edit / block / unblock. */
  onChanged?: (row: CohortStudent) => void;
  /** The account was removed (the roster should drop it and close the drawer). */
  onRemoved?: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ManageData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get<ManageData>(`/tpo/students/${student.id}/manage`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't load this account.");
    }
  }, [student.id]);

  // The drawer is reused for the next student: start closed and empty.
  useEffect(() => {
    setData(null);
    setOpen(false);
  }, [student.id]);

  useEffect(() => {
    if (open && data === null) void load();
  }, [open, data, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const block = async () => {
    const reason = await promptDialog({
      title: `Block ${student.name}?`,
      message: "They are signed out at once and cannot sign in until you unblock them. The reason is kept on the account.",
      placeholder: "e.g. Left the college, exam misconduct",
      confirmLabel: "Block account",
      tone: "danger",
      validate: (v) => (v.trim().length < 3 ? "Give a short reason (3+ characters)." : null),
    });
    if (reason === null) return;
    await run("block", async () => {
      const res = await api.post<{ student: CohortStudent; message: string }>(`/tpo/students/${student.id}/block`, { reason: reason.trim() });
      onChanged?.(res.student);
      toast.success(res.message);
    });
  };

  const unblock = () =>
    run("unblock", async () => {
      const res = await api.post<{ student: CohortStudent; message: string }>(`/tpo/students/${student.id}/unblock`);
      onChanged?.(res.student);
      toast.success(res.message);
    });

  const sendLogin = async () => {
    const ok = await confirmDialog({
      title: "Send a new login?",
      message: `A new one-time password is e-mailed to ${student.email}. Their old password stops working, they are signed out everywhere, and they choose a new password at their next sign-in. You will not see it.`,
      confirmLabel: "Send new login",
    });
    if (!ok) return;
    await run("login", async () => {
      const res = await api.post<{ message: string }>(`/tpo/students/${student.id}/send-login`);
      toast.success(res.message);
    });
  };

  const signOut = async () => {
    const ok = await confirmDialog({ title: "Sign out everywhere?", message: `${student.name} is signed out of every device. Their password is unchanged, so they can sign straight back in.`, confirmLabel: "Sign out" });
    if (!ok) return;
    await run("signout", async () => {
      const res = await api.post<{ message: string }>(`/tpo/students/${student.id}/revoke-sessions`);
      toast.success(res.message);
    });
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Remove ${student.name}?`,
      message: "The account was never used, so it is deleted for good and frees a seat. This cannot be undone.",
      confirmLabel: "Remove account",
      tone: "danger",
    });
    if (!ok) return;
    if (busy) return;
    setBusy("remove");
    try {
      const res = await api.delete<{ message: string }>(`/tpo/students/${student.id}`);
      toast.success(res.message);
      onRemoved?.(student.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this account.");
      setBusy(null);
    }
  };

  const a = data?.account;

  return (
    <section aria-label="Manage account" className="rounded-2xl border border-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
          <UserCog className="h-3.5 w-3.5" aria-hidden /> Manage account
        </span>
        <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border-subtle px-4 pb-4 pt-3">
          {!data || !a ? (
            <p className="py-3 text-2xs text-text-muted">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                <HpPill tone={a.is_blocked ? "rose" : "emerald"} icon={a.is_blocked ? ShieldAlert : ShieldCheck} size="sm">
                  {a.is_blocked ? "Blocked" : "Active"}
                </HpPill>
                <HpPill tone={a.activated ? "slate" : "amber"} size="sm">
                  {a.activated ? `Last seen ${when(a.last_seen_at)}` : "Has never signed in"}
                </HpPill>
                <HpPill tone="sky" size="sm">
                  {data.plan.name}
                  {data.plan.covered_by_college ? " · college plan" : ""}
                </HpPill>
              </div>

              {a.blocked && (
                <HpCallout icon={ShieldAlert} tone="amber">
                  Blocked{a.blocked.by ? ` by ${a.blocked.by}` : ""} on {when(a.blocked.at)}
                  {a.blocked.reason ? `: “${a.blocked.reason}”` : "."}
                </HpCallout>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <HpButton variant="secondary" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
                  Edit details
                </HpButton>
                <HpButton variant="secondary" size="sm" leftIcon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => void sendLogin()} isLoading={busy === "login"} disabled={a.is_blocked}>
                  Send a new login
                </HpButton>
                <HpButton variant="secondary" size="sm" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => void signOut()} isLoading={busy === "signout"} disabled={a.sessions === 0}>
                  Sign out everywhere{a.sessions > 0 ? ` (${a.sessions})` : ""}
                </HpButton>
                {a.is_blocked ? (
                  <HpButton variant="secondary" size="sm" leftIcon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => void unblock()} isLoading={busy === "unblock"}>
                    Unblock account
                  </HpButton>
                ) : (
                  <HpButton variant="secondary" size="sm" leftIcon={<ShieldAlert className="h-3.5 w-3.5" />} onClick={() => void block()} isLoading={busy === "block"}>
                    Block account…
                  </HpButton>
                )}
              </div>

              {data.vault_ai.length > 0 && (
                <div>
                  <p className="mb-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Vault AI Interview (read-only)</p>
                  <ul className="space-y-1">
                    {data.vault_ai.map((q) => (
                      <li key={q.stack} className="flex items-center justify-between gap-2 text-2xs text-text-secondary">
                        <span className="truncate">{q.stack}</span>
                        <span className="shrink-0 capitalize text-text-muted">
                          {q.status.replace("_", " ")}
                          {q.average !== null ? ` · ${q.average}%` : ""} · try {q.attempt}/{q.max_attempts}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.history.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                    <Clock className="h-3 w-3" aria-hidden /> Changes to this account
                  </p>
                  <ul className="space-y-1.5">
                    {data.history.map((h, i) => (
                      <li key={i} className="text-2xs leading-snug text-text-secondary">
                        <span className="font-semibold text-primary">{h.action}</span>
                        {h.reason ? `: “${h.reason}”` : ""}
                        <span className="block text-text-muted">
                          {h.by ?? "Someone"} · {when(h.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-border-subtle pt-3">
                {data.can_remove ? (
                  <HpButton variant="ghost" size="sm" className="text-status-danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => void remove()} isLoading={busy === "remove"}>
                    Remove this account
                  </HpButton>
                ) : (
                  <p className="text-3xs leading-relaxed text-text-muted">{data.remove_blocker}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {editing && data && (
        <EditDetailsModal
          student={student}
          activated={data.account.activated}
          onClose={() => setEditing(false)}
          onSaved={(row, message) => {
            setEditing(false);
            onChanged?.(row);
            toast.success(message);
            void load();
          }}
        />
      )}
    </section>
  );
}

function EditDetailsModal({
  student,
  activated,
  onClose,
  onSaved,
}: {
  student: CohortStudent;
  activated: boolean;
  onClose: () => void;
  onSaved: (row: CohortStudent, message: string) => void;
}) {
  const [form, setForm] = useState({
    name: student.name,
    email: student.email,
    roll_number: student.roll_number ?? "",
    branch: student.branch ?? "",
    cgpa: student.cgpa ?? "",
    tenth_percentage: student.tenth_percentage === null || student.tenth_percentage === undefined ? "" : String(student.tenth_percentage),
    twelfth_percentage: student.twelfth_percentage === null || student.twelfth_percentage === undefined ? "" : String(student.twelfth_percentage),
    backlogs: student.backlogs === null || student.backlogs === undefined ? "" : String(student.backlogs),
    placement_status: (student.placement_status ?? "seeking") as "seeking" | "placed" | "higher_studies" | "entrepreneurship" | "opted_out",
    academics_locked: !!student.academics_locked,
    phone: student.phone ?? "",
    parent_phone: student.parent_phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const orNull = (v: string) => (v.trim() === "" ? null : v.trim());
    try {
      const res = await api.patch<{ student: CohortStudent; message: string }>(`/tpo/students/${student.id}/profile`, {
        name: form.name.trim(),
        ...(activated ? {} : { email: form.email.trim() }),
        roll_number: orNull(form.roll_number),
        branch: orNull(form.branch),
        cgpa: form.cgpa === "" ? null : Number(form.cgpa),
        tenth_percentage: form.tenth_percentage === "" ? null : Number(form.tenth_percentage),
        twelfth_percentage: form.twelfth_percentage === "" ? null : Number(form.twelfth_percentage),
        backlogs: form.backlogs === "" ? null : Number(form.backlogs),
        placement_status: form.placement_status,
        academics_locked: form.academics_locked,
        phone: orNull(form.phone),
        parent_phone: orNull(form.parent_phone),
      });
      onSaved(res.student, res.message);
    } catch (err) {
      setError(err instanceof ApiError ? Object.values(err.errors ?? {})[0]?.[0] ?? err.message : "Couldn't save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title="Edit details"
        subtitle={student.name}
        icon={Pencil}
        size="lg"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="edit-details-form" isLoading={saving}>
              Save changes
            </HpButton>
          </>
        }
      >
        <form id="edit-details-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="ed-name" label="Name" required>
            <input id="ed-name" required value={form.name} onChange={set("name")} className={hpInput} />
          </Field>
          <Field id="ed-roll" label="Roll number">
            <input id="ed-roll" value={form.roll_number} onChange={set("roll_number")} className={hpInput} />
          </Field>
          <Field id="ed-email" label="Login e-mail" hint={activated ? "They have signed in, so only they can change this." : "Not signed in yet: fixing a typo sends the login to the new address."}>
            <input id="ed-email" type="email" value={form.email} onChange={set("email")} disabled={activated} className={cn(hpInput, activated && "opacity-60")} />
          </Field>
          <Field id="ed-branch" label="Branch" hint="Use the name your college uses; AptRun matches it to a branch.">
            <input id="ed-branch" value={form.branch} onChange={set("branch")} className={hpInput} />
          </Field>
          <Field id="ed-cgpa" label="CGPA (0–10)">
            <input id="ed-cgpa" type="number" step="0.01" min={0} max={10} value={form.cgpa} onChange={set("cgpa")} className={hpInput} />
          </Field>
          <Field id="ed-backlogs" label="Active backlogs">
            <input id="ed-backlogs" type="number" min={0} max={99} value={form.backlogs} onChange={set("backlogs")} className={hpInput} />
          </Field>
          <Field id="ed-10th" label="10th %">
            <input id="ed-10th" type="number" step="0.01" min={0} max={100} value={form.tenth_percentage} onChange={set("tenth_percentage")} placeholder="e.g. 92.4" className={hpInput} />
          </Field>
          <Field id="ed-12th" label="12th / Diploma %">
            <input id="ed-12th" type="number" step="0.01" min={0} max={100} value={form.twelfth_percentage} onChange={set("twelfth_percentage")} placeholder="e.g. 88.0" className={hpInput} />
          </Field>
          <Field id="ed-placement-status" label="Placement status">
            <select id="ed-placement-status" value={form.placement_status} onChange={set("placement_status")} className={hpInput}>
              <option value="seeking">Seeking Placement</option>
              <option value="placed">Placed</option>
              <option value="higher_studies">Higher Studies</option>
              <option value="entrepreneurship">Entrepreneurship</option>
              <option value="opted_out">Opted Out</option>
            </select>
          </Field>
          <div className="flex items-end pb-1">
            <label className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border-subtle bg-elevated/40 px-3 py-2 text-xs font-semibold text-primary">
              <input
                type="checkbox"
                checked={form.academics_locked}
                onChange={(e) => setForm((p) => ({ ...p, academics_locked: e.target.checked }))}
                className="h-4 w-4 rounded border-border-strong text-indigo-600 focus:ring-indigo-500"
              />
              <span>Lock verified academics for audit</span>
            </label>
          </div>
          <Field id="ed-phone" label="Phone">
            <input id="ed-phone" value={form.phone} onChange={set("phone")} className={hpInput} />
          </Field>
          <Field id="ed-parent" label="Parent phone">
            <input id="ed-parent" value={form.parent_phone} onChange={set("parent_phone")} className={hpInput} />
          </Field>
          {error && (
            <div className="sm:col-span-2">
              <HpFormError>{error}</HpFormError>
            </div>
          )}
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}

function Field({ id, label, hint, required, children }: { id: string; label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={hpLabel}>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
      {hint && <p className="mt-1 text-2xs text-text-muted">{hint}</p>}
    </div>
  );
}
