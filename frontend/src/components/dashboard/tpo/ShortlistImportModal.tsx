"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, hpInput, hpLabel } from "@/components/portal/kit";
import { HpFormError, HpCallout } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { api, ApiError } from "@/lib/api";
import { DRIVE_APPLICATION_STAGE_LABELS, DRIVE_APPLICATION_STAGES, type DriveApplication, type DriveApplicationStage } from "@/types/placement";

export function ShortlistImportModal({
  driveId,
  driveTitle,
  onClose,
  onImported,
}: {
  driveId: number;
  driveTitle: string;
  onClose: () => void;
  onImported: (apps: DriveApplication[], summary: string) => void;
}) {
  const [stage, setStage] = useState<DriveApplicationStage>("online_test");
  const [ctc, setCtc] = useState("");
  const [identifiers, setIdentifiers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiers.trim() && !file) {
      setError("Paste student roll numbers/emails or upload a CSV/Excel shortlist sheet.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("stage", stage);
      if (ctc.trim() !== "") fd.append("ctc_offered", ctc.trim());
      if (identifiers.trim() !== "") fd.append("identifiers", identifiers.trim());
      if (file) fd.append("file", file);

      const res = await api.postFormData<{
        message: string;
        applications: DriveApplication[];
        unmatched: string[];
      }>(`/tpo/drives/${driveId}/applications/import-shortlist`, fd);

      if (res.unmatched.length > 0 && res.applications.length === 0) {
        setUnmatched(res.unmatched);
        setError(res.message);
        setSubmitting(false);
        return;
      }

      onImported(res.applications, res.message);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import shortlist.");
      setSubmitting(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !submitting && onClose()}
        title="Import Recruiter Shortlist"
        subtitle={driveTitle}
        icon={Upload}
        size="lg"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </HpButton>
            <HpButton type="submit" form="shortlist-import-form" isLoading={submitting}>
              Process Shortlist
            </HpButton>
          </>
        }
      >
        <form id="shortlist-import-form" onSubmit={handleSubmit} className="space-y-4">
          <HpCallout icon={FileSpreadsheet} tone="indigo">
            Auto-registers matched college students if not already in the pipeline and transitions them to the chosen stage.
          </HpCallout>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sl-stage" className={hpLabel}>
                Target Pipeline Stage
              </label>
              <select
                id="sl-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as DriveApplicationStage)}
                className={hpInput}
              >
                {DRIVE_APPLICATION_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {DRIVE_APPLICATION_STAGE_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
            {(stage === "offer_extended" || stage === "offer_accepted") && (
              <div>
                <label htmlFor="sl-ctc" className={hpLabel}>
                  CTC Offered (LPA)
                </label>
                <input
                  id="sl-ctc"
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="e.g. 12.5"
                  value={ctc}
                  onChange={(e) => setCtc(e.target.value)}
                  className={hpInput}
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="sl-file" className={hpLabel}>
              Upload CSV / Excel Shortlist (optional)
            </label>
            <input
              id="sl-file"
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-dashed border-border-strong bg-elevated/40 p-2.5 text-xs text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-500/15 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-600 dark:file:text-indigo-300"
            />
          </div>

          <div>
            <label htmlFor="sl-identifiers" className={hpLabel}>
              Or paste Roll Numbers / Emails (one per line or comma-separated)
            </label>
            <textarea
              id="sl-identifiers"
              rows={5}
              value={identifiers}
              onChange={(e) => setIdentifiers(e.target.value)}
              placeholder={"21CS1001\n21CS1004\nalex.chen@student.edu"}
              className={hpInput}
            />
          </div>

          {error && <HpFormError>{error}</HpFormError>}
          {unmatched && unmatched.length > 0 && (
            <p className="text-2xs text-amber-600 dark:text-amber-300">
              Unmatched values: {unmatched.slice(0, 12).join(", ")}
              {unmatched.length > 12 ? ` (+${unmatched.length - 12} more)` : ""}
            </p>
          )}
        </form>
      </Modal>
    </HpOverlayPortal>
  );
}
