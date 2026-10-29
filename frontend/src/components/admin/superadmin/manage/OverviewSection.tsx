"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, GraduationCap, Loader2, Pencil, ShieldCheck, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import type { ManagedUser } from "@/types/adminSubscriptions";
import { formatDate, formatDateTime, type ApiCollege } from "../types";
import { ReadinessEditModal } from "../ReadinessEditModal";
import { Card, Row, SectionTitle, ghostButton, inputClass, primaryButton, timeAgo, type SectionProps } from "./shared";

/** The student-only numbers the drawer adds from /superadmin/users/{id}/detail. */
export interface StudentDetail {
  user: { readiness_score: number; readiness_tier: "Placement Ready" | "In Progress" | "Needs Training"; readiness_overridden?: boolean };
  stats: { solved_by_difficulty: { total_solved: number }; solved_score: number; streak: { current: number; max: number } };
}

const TIER_STYLE: Record<string, string> = {
  "Placement Ready": "bg-status-success/10 border-status-success/25",
  "In Progress": "bg-accent-secondary/10 border-accent-secondary/25",
  "Needs Training": "bg-status-warning/10 border-status-warning/25",
};

type EditableKey = "name" | "email" | "handle" | "phone" | "roll_number" | "branch" | "section" | "cgpa" | "backlogs" | "college_id";

const FIELD_LABEL: Record<EditableKey, string> = {
  name: "Full name",
  email: "Email (login ID)",
  handle: "Handle",
  phone: "Phone",
  roll_number: "Roll number",
  branch: "Branch",
  section: "Section",
  cgpa: "CGPA",
  backlogs: "Active backlogs",
  college_id: "College",
};

function toDraft(user: ManagedUser): Record<EditableKey, string> {
  return {
    name: user.name,
    email: user.email,
    handle: user.handle ?? "",
    phone: user.phone ?? "",
    roll_number: user.roll_number ?? "",
    branch: user.branch ?? "",
    section: user.section ?? "",
    cgpa: user.cgpa ?? "",
    backlogs: user.backlogs === null ? "" : String(user.backlogs),
    college_id: user.college ? String(user.college.id) : "",
  };
}

export function OverviewSection({ data, reload, triggerToast, detail }: SectionProps & { detail: StudentDetail | null }) {
  const { user, capabilities } = data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(user));
  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableKey, string>>>({});
  const [settingScore, setSettingScore] = useState(false);

  const isStudent = user.role === "user";
  // Student/coordinator fields: a TPO or staff account has no roll number, branch or CGPA to correct.
  const academic = isStudent || user.role === "section_coordinator";
  const movable = isStudent && user.college !== null;

  useEffect(() => {
    if (!editing) setDraft(toDraft(user));
  }, [user, editing]);

  useEffect(() => {
    if (!editing || !movable || colleges.length > 0) return;
    let cancelled = false;
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => !cancelled && setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [editing, movable, colleges.length]);

  const changes = useMemo(() => {
    const original = toDraft(user);
    return (Object.keys(draft) as EditableKey[]).filter((key) => draft[key] !== original[key]);
  }, [draft, user]);

  const visibleKeys: EditableKey[] = [
    "name",
    "email",
    "handle",
    "phone",
    ...(academic ? (["roll_number", "branch", "section", "cgpa", "backlogs"] as EditableKey[]) : []),
    ...(movable ? (["college_id"] as EditableKey[]) : []),
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changes.length === 0 || saving) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    // Only what changed: an untouched field is never rewritten. An emptied optional field is sent as null.
    const body: Record<string, string | number | null> = {};
    for (const key of changes) {
      const value = draft[key].trim();
      if (key === "college_id") body[key] = Number(value);
      else if (key === "backlogs") body[key] = value === "" ? null : Number(value);
      else if (key === "cgpa") body[key] = value === "" ? null : Number(value);
      else if (key === "name" || key === "email") body[key] = value;
      else body[key] = value === "" ? null : value;
    }

    try {
      await api.put(`/superadmin/users/${user.id}`, body);
      triggerToast(`${draft.name.trim() || user.name}'s details were updated.`);
      setEditing(false);
      await reload();
    } catch (err) {
      if (err instanceof ApiError) {
        const flat = Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, v]) => [k, v[0]])) as Partial<Record<EditableKey, string>>;
        setFieldErrors(flat);
        setError(Object.keys(flat).length === 0 ? err.message : null);
      } else {
        setError("Couldn't save. Check your connection and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {detail && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={detail.stats.solved_score} label="Solved score" />
            <Stat value={detail.stats.solved_by_difficulty.total_solved} label="Problems solved" />
            <Stat value={detail.stats.streak.current} label="Day streak" />
          </div>
          <div className={cn("rounded-control border p-3 text-xs", TIER_STYLE[detail.user.readiness_tier])}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-primary">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> {detail.user.readiness_tier}
              </span>
              <span className="font-mono font-bold text-primary">{detail.user.readiness_score}/100</span>
            </div>
            <p className="mt-1 text-text-secondary">Readiness — one score from interviews, practice, the Learning Centre, soft skills, contests, events and consistency (60+ makes a student eligible for the Vault).</p>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              {detail.user.readiness_overridden ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 text-3xs font-bold text-accent-primary">
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> Set by hand
                </span>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => setSettingScore(true)} className={ghostButton}>
                <Target className="h-3 w-3" /> Set score
              </button>
            </div>
          </div>
        </>
      )}

      <div>
        <SectionTitle
          aside={
            capabilities.edit && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className={ghostButton}>
                <Pencil className="h-3 w-3" /> Edit details
              </button>
            ) : undefined
          }
        >
          Details
        </SectionTitle>

        {editing ? (
          <form onSubmit={save} className="space-y-3" aria-label="Edit account details">
            {visibleKeys.map((key) => {
              const id = `manage-edit-${key}`;
              return (
                <div key={key}>
                  <label htmlFor={id} className="mb-1 block text-2xs font-semibold text-text-secondary">
                    {FIELD_LABEL[key]}
                  </label>
                  {key === "college_id" ? (
                    <select id={id} value={draft.college_id} onChange={(e) => setDraft((d) => ({ ...d, college_id: e.target.value }))} className={inputClass}>
                      {user.college && colleges.every((c) => c.id !== user.college!.id) && <option value={user.college.id}>{user.college.name}</option>}
                      {colleges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      inputMode={key === "cgpa" || key === "backlogs" ? "decimal" : undefined}
                      type={key === "email" ? "email" : "text"}
                      aria-invalid={!!fieldErrors[key]}
                      className={cn(inputClass, fieldErrors[key] && "border-status-danger")}
                    />
                  )}
                  {fieldErrors[key] && (
                    <p role="alert" className="mt-1 text-3xs font-semibold text-status-danger">
                      {fieldErrors[key]}
                    </p>
                  )}
                  {key === "email" && draft.email.trim() !== user.email && <p className="mt-1 text-3xs text-text-muted">This is their login — they will sign in with the new address from now on.</p>}
                  {key === "phone" && draft.phone.trim() !== (user.phone ?? "") && user.phone_verified && (
                    <p className="mt-1 text-3xs text-text-muted">Their verified number will need to be verified again.</p>
                  )}
                  {key === "college_id" && draft.college_id !== String(user.college?.id) && (
                    <p className="mt-1 flex items-start gap-1 text-3xs text-text-muted">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-status-warning" aria-hidden />
                      Moving a student changes which college&apos;s plan, drives and cohort they belong to, and counts against the new college&apos;s seats.
                    </p>
                  )}
                </div>
              );
            })}

            {error && (
              <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button type="submit" disabled={changes.length === 0 || saving} className={primaryButton}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save changes
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                  setFieldErrors({});
                }}
                className={ghostButton}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <Card>
            <dl>
              <Row label="Email">{user.email}</Row>
              <Row label="Handle">{user.handle ? `@${user.handle}` : "—"}</Row>
              <Row label="Phone">
                {user.phone ?? "Not on file"}
                {user.phone && <span className={cn("ml-1.5 text-3xs font-bold", user.phone_verified ? "text-status-success" : "text-text-muted")}>{user.phone_verified ? "verified" : "unverified"}</span>}
              </Row>
              {user.college && <Row label="College">{user.college.name}</Row>}
              {user.company && <Row label="Company">{user.company.name}</Row>}
              {academic && (
                <>
                  <Row label="Roll number" mono>
                    {user.roll_number ?? "—"}
                  </Row>
                  <Row label="Branch">{user.branch ?? "—"}</Row>
                  <Row label="Section">{user.section ?? "—"}</Row>
                  <Row label="CGPA" mono>
                    {user.cgpa ?? "—"}
                  </Row>
                  <Row label="Active backlogs" mono>
                    {user.backlogs ?? "—"}
                  </Row>
                </>
              )}
              {user.permissions && user.permissions.length > 0 && <Row label="Access to">{user.permissions.join(", ").replace(/_/g, " ")}</Row>}
              <Row label="Joined">{formatDate(user.created_at)}</Row>
              <Row label="Last seen">
                {user.last_seen_at ? (
                  <span title={formatDateTime(user.last_seen_at)}>{timeAgo(user.last_seen_at)}</span>
                ) : (
                  "Not since sign-in tracking began"
                )}
              </Row>
              {user.is_lead && <Row label="Sales lead">{user.lead_status ?? "new"}</Row>}
            </dl>
          </Card>
        )}
      </div>

      {isStudent && !user.college && (
        <p className="flex items-start gap-2 text-2xs text-text-muted">
          <GraduationCap className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Independent learner — signed up on their own, so they pay for their own plan.
        </p>
      )}

      {settingScore && (
        <ReadinessEditModal
          studentId={user.id}
          onClose={() => setSettingScore(false)}
          onChanged={(message) => {
            setSettingScore(false);
            triggerToast(message);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-control border border-border-subtle bg-elevated/60 p-2.5">
      <div className="font-mono text-base font-black text-primary">{value}</div>
      <div className="mt-1 text-3xs uppercase text-text-muted">{label}</div>
    </div>
  );
}
