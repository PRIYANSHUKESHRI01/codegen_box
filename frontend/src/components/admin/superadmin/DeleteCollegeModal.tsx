"use client";

import { useEffect, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

/** Mirrors CollegePurgeService::preview() on the backend. */
export interface CollegeImpact {
  tpos: number;
  coordinators: number;
  students: number;
  accounts_kept_detached: number;
  drives: number;
  contests: number;
  interviews: number;
  interview_tracks: number;
  interview_role_templates: number;
  soft_skill_assessments: number;
  drive_applications: number;
}

const LINES: { key: keyof CollegeImpact; singular: string; plural: string }[] = [
  { key: "tpos", singular: "TPO account", plural: "TPO accounts" },
  { key: "coordinators", singular: "Section Coordinator account", plural: "Section Coordinator accounts" },
  { key: "students", singular: "student account, with all their practice, test and interview history", plural: "student accounts, with all their practice, test and interview history" },
  { key: "drives", singular: "placement drive the college created", plural: "placement drives the college created" },
  { key: "drive_applications", singular: "drive application", plural: "drive applications" },
  { key: "contests", singular: "mock contest", plural: "mock contests" },
  { key: "interviews", singular: "mock interview", plural: "mock interviews" },
  { key: "interview_tracks", singular: "interview track", plural: "interview tracks" },
  { key: "interview_role_templates", singular: "interview role template", plural: "interview role templates" },
  { key: "soft_skill_assessments", singular: "soft-skill assessment", plural: "soft-skill assessments" },
];

interface DeleteCollegeModalProps {
  college: { id: number; name: string };
  onClose: () => void;
  /** Called once the university is really gone, so the list can refresh. */
  onDeleted: (collegeName: string) => void;
}

/**
 * Permanent, irreversible. Three deliberate steps stand between a click and the
 * delete: seeing exactly what will be destroyed, typing the university's name,
 * and re-entering the superadmin's own password. The button stays disabled until
 * both fields are right, and the server re-checks both — this is convenience,
 * not the safeguard.
 */
export function DeleteCollegeModal({ college, onClose, onDeleted }: DeleteCollegeModalProps) {
  const [impact, setImpact] = useState<CollegeImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ impact: CollegeImpact }>(`/superadmin/colleges/${college.id}/deletion-preview`)
      .then((res) => !cancelled && setImpact(res.impact))
      .catch((err) => !cancelled && setImpactError(err instanceof ApiError ? err.message : "Could not load what this would delete."));
    return () => {
      cancelled = true;
    };
  }, [college.id]);

  // The server trims what is typed before comparing, so a trailing space or newline picked up when the name is
  // copied off the page must not keep the button disabled here either.
  const nameMatches = typedName.trim() === college.name;
  const nameLooksWrong = typedName.trim() !== "" && !nameMatches;
  const canDelete = impact !== null && nameMatches && password.length > 0 && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setWorking(true);
    setError(null);
    try {
      await api.delete(`/superadmin/colleges/${college.id}`, { password, confirm_name: typedName.trim() });
      onDeleted(college.name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : // No answer at all (timeout, dropped connection). A big university is a long delete that keeps running on the
            // server after the browser gives up, so "try again" would be the wrong advice.
            "No answer from the server. A large university can take a while, so it may still be deleting — close this dialog, refresh the list, and only try again if the university is still there."
      );
      setWorking(false);
    }
  };

  const shown = impact ? LINES.filter((l) => impact[l.key] > 0) : [];

  return (
    <Modal
      onClose={onClose}
      title="Permanently delete university"
      subtitle={college.name}
      icon={Trash2}
      iconClassName="bg-status-danger/10 text-status-danger"
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="delete-college-form"
            disabled={!canDelete}
            className="px-4 py-2 rounded-control bg-status-danger hover:opacity-90 text-white font-bold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {working ? "Deleting…" : "Permanently delete"}
          </button>
        </>
      }
    >
      <form id="delete-college-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-px" />
          <span className="font-semibold">This cannot be undone. There is no recycle bin and no backup is taken.</span>
        </div>

        <div>
          <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">What will be deleted</div>
          {impactError ? (
            <div role="alert" className="p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs font-semibold">
              {impactError}
              <span className="block mt-1 font-normal">
                The delete stays locked until this loads. Close the dialog and try again; if it keeps failing, the server may be running an older version without this feature.
              </span>
            </div>
          ) : impact === null ? (
            <div className="text-xs text-text-muted">Counting…</div>
          ) : (
            <ul className="space-y-1 text-xs text-primary">
              <li className="font-bold">The university itself, and its plan/subscription history</li>
              {shown.map((l) => (
                <li key={l.key}>
                  <span className="font-bold tabular-nums">{impact[l.key].toLocaleString()}</span> {impact[l.key] === 1 ? l.singular : l.plural}
                </li>
              ))}
            </ul>
          )}
          {impact !== null && impact.accounts_kept_detached > 0 && (
            <p className="mt-2 text-2xs text-text-muted">
              {impact.accounts_kept_detached} Mellow staff / company account(s) linked to this university are <strong>kept</strong> — they are only unlinked from it.
            </p>
          )}
          <p className="mt-2 text-2xs text-text-muted">
            Anyone deleted can no longer sign in, and their email addresses become free to use again. A large university can take a minute.
          </p>
        </div>

        <div>
          <label htmlFor="delete-college-name" className="block text-xs font-semibold text-text-secondary mb-1">
            Type <span className="font-mono text-primary select-all">{college.name}</span> to confirm
          </label>
          <input
            id="delete-college-name"
            type="text"
            autoComplete="off"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            aria-describedby={nameLooksWrong ? "delete-college-name-hint" : undefined}
            className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-status-danger"
          />
          {nameLooksWrong && (
            <p id="delete-college-name-hint" className="mt-1 text-2xs text-status-warning">
              Doesn&apos;t match yet — type the name exactly as shown above, including capital letters and punctuation.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="delete-college-password" className="block text-xs font-semibold text-text-secondary mb-1">
            Your password (to confirm it&apos;s you)
          </label>
          <input
            id="delete-college-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-status-danger"
          />
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs font-semibold">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
