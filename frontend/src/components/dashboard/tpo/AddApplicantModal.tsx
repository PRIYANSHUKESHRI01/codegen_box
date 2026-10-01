"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DriveApplication } from "@/types/placement";
import { Modal } from "@/components/ui/Modal";

interface RosterStudent {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
}

interface AddApplicantModalProps {
  placementDriveId: number;
  companyName: string;
  excludeUserIds: number[];
  onClose: () => void;
  onAdded: (application: DriveApplication) => void;
}

/**
 * The manual-override counterpart to "Register Eligible Students" —
 * for a student a company approved outside the standard cutoffs, or one
 * the eligibility rule doesn't (yet) capture correctly. Same
 * search-then-pick shape as CreateDriveModal's company picker.
 */
export function AddApplicantModal({ placementDriveId, companyName, excludeUserIds, onClose, onAdded }: AddApplicantModalProps) {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RosterStudent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ students: RosterStudent[] }>("/tpo/students/cohort")
      .then((res) => setRoster(res.students))
      .catch(() => setRoster([]))
      .finally(() => setLoadingRoster(false));
  }, []);

  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    return roster
      .filter((s) => !excludeSet.has(s.id))
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.roll_number ?? "").toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [roster, query, excludeSet]);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ application: DriveApplication }>(
        `/tpo/drives/${placementDriveId}/applications`,
        { user_id: selected.id }
      );
      onAdded(res.application);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add this applicant.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Add Applicant — ${companyName}`}
      icon={UserPlus}
      iconClassName="bg-accent-secondary/10 text-accent-secondary"
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selected || submitting}
            className={cn(
              "px-4 py-2 rounded-control text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5",
              "bg-accent-primary hover:bg-accent-primary-hover"
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{submitting ? "Adding..." : "Add Applicant"}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-2xs text-text-muted">
          For a student a company approved outside the standard eligibility cutoffs — most students should come in via
          &quot;Register Eligible Students&quot; instead.
        </p>

        {error && <p className="text-2xs text-status-danger">{error}</p>}

        {selected ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-control bg-elevated border border-accent-primary/30">
            <span className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
              <span className="min-w-0">
                <span className="font-semibold text-primary truncate block">{selected.name}</span>
                <span className="text-3xs text-text-muted truncate block">
                  {selected.roll_number ?? "No roll number"} · {selected.branch ?? "No branch"}
                </span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-2xs font-bold text-accent-primary hover:underline shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={loadingRoster ? "Loading your cohort..." : "Search by name, roll number, or email..."}
                disabled={loadingRoster}
                className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs placeholder:text-text-muted outline-none focus:border-accent-primary disabled:opacity-60"
              />
              {loadingRoster && <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}
            </div>

            {results.length > 0 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-control border border-border-subtle divide-y divide-border-subtle">
                {results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="w-full px-3 py-2 text-left hover:bg-elevated transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="text-xs font-semibold text-primary block truncate">{s.name}</span>
                      <span className="text-3xs text-text-muted block truncate">
                        {s.roll_number ?? "—"} · {s.branch ?? "—"} · {s.email}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {query.trim().length > 0 && results.length === 0 && !loadingRoster && (
              <p className="mt-2 text-2xs text-text-muted text-center py-3">
                No matching student, or they&apos;re already registered for this drive.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
